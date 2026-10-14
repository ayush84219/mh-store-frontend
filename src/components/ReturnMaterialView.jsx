import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  RotateCcw, Search, Package, AlertTriangle, CheckCircle,
  Plus, Trash2, X, Layers, Info, Zap, Clock,
  ChevronDown, ChevronUp, Hash, Tag, User, Calendar, Box,
  TrendingDown, FileText, BarChart3, ArrowLeft, Barcode,
  Printer, Download, Copy, Check, Filter, ExternalLink, RefreshCw, Eye
} from 'lucide-react';

// Helper to extract strictly active BOM components where status is 'Yes'
export const getActiveBomItems = (design) => {
  if (!design) return [];
  const items = [];
  const seen = new Set();

  if (Array.isArray(design.bom)) {
    design.bom.forEach(b => {
      const isYes = String(b.status || '').trim().toLowerCase() === 'yes' || b.status === true || b.isRequired === true;
      if (isYes && b.name && !seen.has(b.name.toLowerCase().trim())) {
        seen.add(b.name.toLowerCase().trim());
        items.push({
          name: b.name,
          detail: b.detail || b.description || (b.quantity ? `Qty: ${b.quantity}` : ''),
          materialId: b.materialId || '',
          status: 'Yes'
        });
      }
    });
  }

  // Also check direct flags on design object if not in bom
  const checkDirectFlag = (flagVal, name, detail) => {
    if (String(flagVal || '').trim().toLowerCase() === 'yes') {
      const key = name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ name, detail: detail || `${name} required`, status: 'Yes', materialId: '' });
      }
    }
  };

  checkDirectFlag(design.zip, 'Zip', design.zipDetail || 'Zip required');
  checkDirectFlag(design.fullBaju, 'Full Baju', 'Full Baju required');
  checkDirectFlag(design.label, 'Label', 'Label required');
  checkDirectFlag(design.tag, 'Tag', 'Tag required');
  checkDirectFlag(design.dori, 'Dori', 'Dori required');
  checkDirectFlag(design.sticker, 'Sticker', 'Sticker required');
  checkDirectFlag(design.collar, 'Collar', 'Collar required');

  return items;
};

function SearchableMaterialSelect({ materials, value, onChange, placeholder = "— Select Material —" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  const selectedMaterial = materials.find(m => String(m.id) === String(value));
  
  const getDisplayLabel = (m) => {
    if (!m) return '';
    return `${m.name}${m.color && m.color !== 'Default' ? ` (${m.color})` : ''} — ${m.stock} ${m.unit}`;
  };
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
    const label = `${m.name} ${m.color || ''}`.toLowerCase();
    return label.includes(searchQuery.toLowerCase());
  });

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 9999 : 1 }}>
      <div 
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) {
            setSearchQuery('');
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          width: '100%',
          padding: '10px 14px',
          borderRadius: '10px',
          border: '1.5px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-primary, #f8fafc)',
          color: selectedMaterial ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #64748b)',
          fontSize: '0.9rem',
          fontWeight: '500',
          transition: 'all 0.2s ease',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(99, 102, 241, 0.12)' : 'none',
          borderColor: isOpen ? '#6366f1' : 'var(--border-color, #e2e8f0)'
        }}
      >
        <span style={{ 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          paddingRight: '8px'
        }}>
          {selectedMaterial ? getDisplayLabel(selectedMaterial) : placeholder}
        </span>
        <ChevronDown size={16} style={{ 
          color: 'var(--text-muted)',
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s ease',
          flexShrink: 0
        }} />
      </div>

      {isOpen && (
        <div className="rm-dropdown-card" style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          border: '1.5px solid var(--border-color-dark, #94a3b8)',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08)',
          zIndex: 9999,
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: '260px'
        }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }} />
            <input
              type="text"
              placeholder="Type to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
                fontSize: '0.85rem',
                outline: 'none',
                background: 'var(--bg-primary, #f8fafc)',
                color: 'var(--text-main, #0f172a)'
              }}
              autoFocus
            />
          </div>

          <div style={{ 
            overflowY: 'auto', 
            maxHeight: '180px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            {filtered.length > 0 ? (
              filtered.map(m => (
                <div
                  key={m.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(m.id);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '500',
                    color: String(m.id) === String(value) ? '#fff' : 'var(--text-main, #0f172a)',
                    background: String(m.id) === String(value) 
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' 
                      : 'transparent',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (String(m.id) !== String(value)) {
                      e.currentTarget.style.background = 'var(--bg-primary, #f8fafc)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (String(m.id) !== String(value)) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {getDisplayLabel(m)}
                </div>
              ))
            ) : (
              <div style={{
                padding: '12px 8px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.85rem'
              }}>
                No materials match search
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReturnMaterialView({
  designs = [],
  materials = [],
  onReturnMaterials,
  issueLogs = []
}) {
  const [mode, setMode] = useState('lot');
  const [lotInput, setLotInput] = useState('');
  const [fetchedDesign, setFetchedDesign] = useState(null);
  const [fetchError, setFetchError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [lotHistory, setLotHistory] = useState([]);
  const [returnItems, setReturnItems] = useState([{ materialId: '', bomItemName: '', qty: '', note: '' }]);
  const [returnNotes, setReturnNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  // ── Return History State ─────────────────────────────────────────────────
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('all'); // 'all'|'today'|'yesterday'|'last7'|'thisMonth'|'custom'
  const [historySpecificDate, setHistorySpecificDate] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all'); // 'all'|'lot'|'quick'
  const [selectedReturnSlip, setSelectedReturnSlip] = useState(null);
  const [copiedVoucherId, setCopiedVoucherId] = useState(null);

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

  const fetchLot = useCallback((lotId) => {
    if (!lotId || lotId.trim() === '') {
      setFetchedDesign(null);
      setLotHistory([]);
      setFetchError('');
      return;
    }
    setIsFetching(true);
    setFetchError('');

    setTimeout(() => {
      const id = lotId.trim();
      const design = designs.find(
        d => String(d.id).toLowerCase() === id.toLowerCase() || (d.lotNo2 && d.lotNo2.toLowerCase() === id.toLowerCase())
      );

      if (!design) {
        setFetchedDesign(null);
        setLotHistory([]);
        setFetchError(`No lot found with ID "${id}". Please verify the lot number.`);
      } else {
        setFetchedDesign(design);
        setFetchError('');
        const logsForLot = issueLogs.filter(
          log => String(log.lotId) === String(design.id) && !log.isReturn
        );
        setLotHistory(logsForLot);

        // 1. Gather strictly active BOM components for this lot only
        const activeBomItems = getActiveBomItems(design);

        const mappedRows = [];

        // Strictly populate from active BOM items only
        activeBomItems.forEach(b => {
          const compName = b.name;
          const key = compName.toLowerCase().trim();

          // Find if this BOM item was issued in previous logs
          let issuedQty = 0;
          let matchedMaterialId = b.materialId || '';
          let unit = 'Pcs';

          logsForLot.forEach(log => {
            log.materials?.forEach(m => {
              const mBom = (m.bomItemName || '').toLowerCase().trim();
              const mName = (m.name || '').toLowerCase().trim();
              if (mBom === key || mName === key || mName.includes(key)) {
                issuedQty += (Number(m.qty) || 0);
                if (m.unit) unit = m.unit;
                if (!matchedMaterialId) {
                  const foundMat = materials.find(mat => {
                    const fullName = mat.color && mat.color !== 'Default' ? `${mat.name} (${mat.color})` : mat.name;
                    return fullName === m.name || String(mat.id) === String(m.materialId);
                  });
                  if (foundMat) matchedMaterialId = foundMat.id;
                }
              }
            });
          });

          // If material not yet found, match in inventory by name / category / color
          if (!matchedMaterialId) {
            const foundMat = materials.find(mat => {
              const mName = (mat.name || '').toLowerCase();
              const mCat = (mat.category || '').toLowerCase();
              const bLower = compName.toLowerCase();
              return mName === bLower || mCat === bLower || mName.includes(bLower);
            });
            if (foundMat) matchedMaterialId = foundMat.id;
          }

          mappedRows.push({
            materialId: matchedMaterialId,
            bomItemName: compName,
            qty: '',
            note: issuedQty > 0 ? `Issued: ${issuedQty} ${unit}` : (b.detail ? `BOM Req: ${b.detail}` : '')
          });
        });

        if (mappedRows.length > 0) {
          setReturnItems(mappedRows);
        } else {
          setReturnItems([{ materialId: '', bomItemName: '', qty: '', note: '' }]);
        }
      }
      setIsFetching(false);
    }, 300);
  }, [designs, issueLogs, materials]);

  // Process Barcode Scan (Supports scanning Lot # or Material ID / Barcode)
  const handleBarcodeScanSubmit = (e) => {
    if (e) e.preventDefault();
    const raw = barcodeInput.trim();
    if (!raw) return;

    setBarcodeScanFeedback(null);
    const upperRaw = raw.toUpperCase();

    // 1. Check if scanned code matches a Lot Number
    const matchedLot = designs.find(d => {
      const id = String(d.id || '').toUpperCase();
      const lot2 = String(d.lotNo2 || '').toUpperCase();
      return id === upperRaw || lot2 === upperRaw || `LOT #${id}` === upperRaw || `LOT-${id}` === upperRaw;
    });

    if (matchedLot) {
      playScanChirp();
      setLotInput(String(matchedLot.id));
      fetchLot(String(matchedLot.id));
      setBarcodeScanFeedback({
        type: 'success',
        msg: `✅ Scanned Lot #${matchedLot.id} (${matchedLot.brand || matchedLot.style || 'Design'}). Auto-loaded active BOM items!`
      });
      setBarcodeInput('');
      setTimeout(() => {
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
      }, 100);
      return;
    }

    // 2. Check if scanned code matches an Inventory Material
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

    if (matchedMat) {
      playScanChirp();
      let matchedIdx = null;

      setReturnItems(prev => {
        const next = [...prev];
        // Check if material is already present in a row
        const existingIdx = next.findIndex(item => String(item.materialId) === String(matchedMat.id));

        if (existingIdx !== -1) {
          matchedIdx = existingIdx;
          const curQty = parseFloat(next[existingIdx].qty) || 0;
          next[existingIdx] = {
            ...next[existingIdx],
            qty: curQty > 0 ? String(curQty + 1) : '1'
          };
        } else {
          // Find first unassigned row
          const unassignedIdx = next.findIndex(item => !item.materialId || item.materialId === '');
          if (unassignedIdx !== -1) {
            matchedIdx = unassignedIdx;
            next[unassignedIdx] = {
              ...next[unassignedIdx],
              materialId: matchedMat.id,
              bomItemName: next[unassignedIdx].bomItemName || matchedMat.category || matchedMat.name,
              qty: '1'
            };
          } else {
            // Append new row
            matchedIdx = next.length;
            next.push({
              materialId: matchedMat.id,
              bomItemName: matchedMat.category || matchedMat.name,
              qty: '1',
              note: `Current Stock: ${matchedMat.stock} ${matchedMat.unit || 'pcs'}`
            });
          }
        }
        return next;
      });

      setHighlightedRowIndex(matchedIdx);
      setBarcodeScanFeedback({
        type: 'success',
        msg: `✅ Barcode Scanned: Matched "${matchedMat.name}" (Stock: ${matchedMat.stock} ${matchedMat.unit || 'Pcs'}). Row updated for Return.`
      });
      setBarcodeInput('');
      setTimeout(() => {
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
      }, 100);
      return;
    }

    // If neither Lot nor Material matched
    setBarcodeScanFeedback({
      type: 'error',
      msg: `❌ No Lot or Material found matching barcode/ID "${raw}". Please verify barcode or lot number.`
    });
  };

  const debounceTimer = useRef(null);
  const handleLotInputChange = (val) => {
    setLotInput(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchLot(val);
    }, 500);
  };

  const handleAddRow = () => {
    const currentBomItems = getActiveBomItems(fetchedDesign);
    const unusedBom = currentBomItems.find(b => !returnItems.some(r => r.bomItemName === b.name));
    const defaultBomName = unusedBom ? unusedBom.name : (currentBomItems[0]?.name || '');
    setReturnItems(prev => [...prev, { materialId: '', bomItemName: defaultBomName, qty: '', note: '' }]);
  };

  const handleRemoveRow = (index) => {
    setReturnItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setReturnItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'bomItemName' && fetchedDesign && value) {
        for (const log of lotHistory) {
          const found = log.materials?.find(m => m.bomItemName === value);
          if (found) {
            const mat = materials.find(m => {
              const mName = m.color && m.color !== 'Default' ? `${m.name} (${m.color})` : m.name;
              return mName === found.name;
            });
            if (mat) {
              updated[index].materialId = mat.id;
              updated[index].note = `Issued: ${found.qty} ${found.unit || 'pcs'}`;
              break;
            }
          }
        }
        if (!updated[index].materialId && fetchedDesign.bom) {
          const bomItem = fetchedDesign.bom.find(b => b.name === value);
          if (bomItem && bomItem.materialId) {
            updated[index].materialId = bomItem.materialId;
          }
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const validItems = returnItems.filter(item => item.materialId && parseFloat(item.qty) > 0);
    if (validItems.length === 0) {
      setFormError('Please add at least one material with a valid quantity to return.');
      return;
    }
    for (const item of validItems) {
      if (isNaN(parseFloat(item.qty)) || parseFloat(item.qty) <= 0) {
        setFormError('All return quantities must be positive numbers.');
        return;
      }
    }

    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 600));

    const itemsToSubmit = validItems.map(item => ({
      materialId: item.materialId,
      bomItemName: item.bomItemName ? item.bomItemName.trim() : 'General Return',
      qty: parseFloat(item.qty)
    }));

    const lotId = mode === 'lot' && fetchedDesign ? fetchedDesign.id : 'N/A';
    onReturnMaterials(itemsToSubmit, returnNotes.trim(), lotId);

    setIsSubmitting(false);
    setFormSuccess(`${validItems.length} material${validItems.length > 1 ? 's' : ''} returned successfully! Inventory has been updated.`);
    setReturnItems([{ materialId: '', bomItemName: '', qty: '', note: '' }]);
    setReturnNotes('');
    setFetchedDesign(null);
    setLotInput('');
    setLotHistory([]);
    setTimeout(() => setFormSuccess(''), 6000);
  };

  const getIssuedQty = (materialName) => {
    let total = 0;
    lotHistory.forEach(log => {
      log.materials?.forEach(m => {
        if (m.name === materialName || m.bomItemName === materialName) {
          total += m.qty || 0;
        }
      });
    });
    return Math.round(total * 100) / 100;
  };

  const bomItems = getActiveBomItems(fetchedDesign);
  const totalReturnQty = returnItems.reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0);
  const filledItems = returnItems.filter(i => i.materialId && parseFloat(i.qty) > 0).length;

  // ── Return History Memoized Data & Handlers ──────────────────────────────
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

  const returnLogs = useMemo(() => {
    return (issueLogs || []).filter(l => {
      if (!l) return false;
      const idUpper = String(l.id || '').toUpperCase();
      const typeUpper = String(l.type || '').toUpperCase();
      return l.isReturn === true || l.isReturn === 1 || String(l.isReturn).toLowerCase() === 'true' || idUpper.startsWith('MR') || typeUpper === 'RETURN' || typeUpper === 'RETURN_MATERIAL';
    }).map(log => {
      let mats = [];
      if (Array.isArray(log.materials)) {
        mats = log.materials;
      } else if (typeof log.materials === 'string') {
        try { mats = JSON.parse(log.materials); } catch (_) { mats = []; }
      }
      const totalQty = mats.reduce((sum, m) => sum + (Number(m.qty) || 0), 0);
      const isLotReturn = Boolean(log.lotId && log.lotId !== 'N/A' && log.lotId !== 'DIRECT-ITEM');
      const matchedDesign = designs.find(d => String(d.id).toLowerCase() === String(log.lotId || '').toLowerCase() || (d.lotNo2 && d.lotNo2.toLowerCase() === String(log.lotId || '').toLowerCase()));

      return {
        ...log,
        parsedMaterials: mats,
        totalQty: Math.round(totalQty * 100) / 100,
        isLotReturn,
        designInfo: matchedDesign
      };
    });
  }, [issueLogs, designs]);

  const filteredReturnLogs = useMemo(() => {
    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayYmd = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysYmd = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;
    const firstOfMonthYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    return returnLogs.filter(log => {
      const dObj = parseDateToObj(log.date || log.created_at);
      const ymd = dObj.getFullYear() > 1970
        ? `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`
        : '';

      // Date filter
      if (historyDateFilter === 'today' && ymd !== todayYmd) return false;
      if (historyDateFilter === 'yesterday' && ymd !== yesterdayYmd) return false;
      if (historyDateFilter === 'last7' && (ymd < sevenDaysYmd || ymd > todayYmd)) return false;
      if (historyDateFilter === 'thisMonth' && ymd < firstOfMonthYmd) return false;
      if (historyDateFilter === 'custom' && historySpecificDate && ymd !== historySpecificDate) return false;

      // Type filter
      if (historyTypeFilter === 'lot' && !log.isLotReturn) return false;
      if (historyTypeFilter === 'quick' && log.isLotReturn) return false;

      // Search filter
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase().trim();
        const idMatch = String(log.id || '').toLowerCase().includes(q);
        const lotMatch = String(log.lotId || '').toLowerCase().includes(q);
        const personMatch = String(log.personName || '').toLowerCase().includes(q);
        const catMatch = String(log.category || '').toLowerCase().includes(q);
        const designMatch = log.designInfo && (
          String(log.designInfo.style || '').toLowerCase().includes(q) ||
          String(log.designInfo.brand || '').toLowerCase().includes(q)
        );
        const matMatch = (log.parsedMaterials || []).some(m =>
          String(m.name || '').toLowerCase().includes(q) ||
          String(m.bomItemName || '').toLowerCase().includes(q)
        );
        if (!idMatch && !lotMatch && !personMatch && !catMatch && !designMatch && !matMatch) {
          return false;
        }
      }

      return true;
    });
  }, [returnLogs, historyDateFilter, historySpecificDate, historyTypeFilter, historySearchQuery]);

  // Overall metrics for Return History
  const historyMetrics = useMemo(() => {
    let totalUnits = 0;
    const uniqueMats = new Set();
    let lotCount = 0;
    let quickCount = 0;

    filteredReturnLogs.forEach(log => {
      totalUnits += log.totalQty || 0;
      if (log.isLotReturn) lotCount++;
      else quickCount++;
      (log.parsedMaterials || []).forEach(m => {
        if (m.name) uniqueMats.add(String(m.name).trim().toLowerCase());
      });
    });

    return {
      totalReturns: filteredReturnLogs.length,
      totalUnits: Math.round(totalUnits * 100) / 100,
      uniqueMaterials: uniqueMats.size,
      lotReturns: lotCount,
      quickReturns: quickCount
    };
  }, [filteredReturnLogs]);

  const handleCopyVoucherId = (id) => {
    if (!id) return;
    navigator.clipboard?.writeText(id);
    setCopiedVoucherId(id);
    setTimeout(() => setCopiedVoucherId(null), 2000);
  };

  const exportReturnHistoryToCsv = () => {
    if (filteredReturnLogs.length === 0) return;
    const headers = [
      'Return Voucher ID',
      'Date & Time',
      'Return Mode',
      'Lot Number',
      'Garment Style',
      'Material Name',
      'BOM Component',
      'Returned Qty',
      'Unit',
      'Remarks / Reason'
    ];
    const rows = [];
    filteredReturnLogs.forEach(log => {
      const modeLabel = log.isLotReturn ? 'Lot Return' : 'Quick Return';
      const lotNo = log.lotId || 'N/A';
      const styleName = log.designInfo?.style || log.category || 'N/A';
      const remarks = log.personName || '';

      if (log.parsedMaterials.length === 0) {
        rows.push([log.id, log.date || '', modeLabel, lotNo, styleName, '—', '—', '0', 'pcs', remarks]);
      } else {
        log.parsedMaterials.forEach(m => {
          rows.push([
            log.id,
            log.date || '',
            modeLabel,
            lotNo,
            styleName,
            m.name || 'Unknown',
            m.bomItemName || 'Return',
            m.qty || 0,
            m.unit || 'pcs',
            remarks
          ]);
        });
      }
    });

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `material_return_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReturnVoucher = (slip) => {
    if (!slip) return;
    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (!printWindow) {
      alert('Please allow popup windows to print the Return Voucher slip.');
      return;
    }
    const materialsHtml = (slip.parsedMaterials || []).map((m, idx) => `
      <tr>
        <td style="border: 1px solid #000; padding: 7px 10px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #000; padding: 7px 10px; font-weight: bold;">${m.name || 'Material'}</td>
        <td style="border: 1px solid #000; padding: 7px 10px;">${m.bomItemName || 'Return'}</td>
        <td style="border: 1px solid #000; padding: 7px 10px; text-align: right; font-weight: bold;">${m.qty}</td>
        <td style="border: 1px solid #000; padding: 7px 10px; text-align: center;">${m.unit || 'pcs'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Return Voucher - ${slip.id}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 24px; color: #000; }
          .voucher-box { border: 2px solid #000; padding: 24px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 18px; }
          .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
          .header h2 { margin: 4px 0 0; font-size: 13px; font-weight: normal; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; font-size: 13px; }
          .meta-item { display: flex; }
          .meta-label { font-weight: bold; width: 140px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; margin-bottom: 24px; font-size: 13px; }
          th { border: 1.5px solid #000; padding: 8px 10px; background: #eee; text-align: left; }
          .remarks { border: 1px solid #000; padding: 12px; font-size: 12px; margin-bottom: 36px; min-height: 40px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; }
          .sig-block { text-align: center; width: 200px; border-top: 1px dashed #000; padding-top: 6px; font-size: 12px; font-weight: bold; }
          @media print {
            body { margin: 0; }
            .voucher-box { border: 2px solid #000; }
          }
        </style>
      </head>
      <body>
        <div class="voucher-box">
          <div class="header">
            <h1>MATERIAL RETURN VOUCHER (MRV)</h1>
            <h2>Warehouse Accessories Inventory Return Slip</h2>
          </div>
          <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">Voucher No:</span><strong>${slip.id}</strong></div>
            <div class="meta-item"><span class="meta-label">Date & Time:</span><span>${slip.date || '—'}</span></div>
            <div class="meta-item"><span class="meta-label">Return Mode:</span><span>${slip.isLotReturn ? `Lot Return (#${slip.lotId})` : 'Quick / Direct Return'}</span></div>
            <div class="meta-item"><span class="meta-label">Style / Garment:</span><span>${slip.designInfo?.style || slip.category || 'N/A'}</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>Material Description</th>
                <th>BOM Component</th>
                <th style="width: 100px; text-align: right;">Returned Qty</th>
                <th style="width: 80px; text-align: center;">Unit</th>
              </tr>
            </thead>
            <tbody>
              ${materialsHtml}
            </tbody>
          </table>
          <div class="remarks">
            <strong>Return Reason / Remarks:</strong><br/>
            ${slip.personName || 'Excess or unused material returned back to warehouse inventory stock.'}
          </div>
          <div class="signatures">
            <div class="sig-block">Returned By (Floor)</div>
            <div class="sig-block">Store In-Charge (Receiver)</div>
            <div class="sig-block">Authorized Signatory</div>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printAllReturnHistory = () => {
    if (filteredReturnLogs.length === 0) return;
    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
      alert('Please allow popup windows to print report.');
      return;
    }
    const rowsHtml = filteredReturnLogs.map((log, idx) => {
      const itemsText = (log.parsedMaterials || []).map(m => `${m.name} (${m.qty} ${m.unit || 'pcs'})`).join(', ') || '—';
      return `
        <tr>
          <td style="border: 1px solid #000; padding: 6px 8px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #000; padding: 6px 8px; font-weight: bold;">${log.id}</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">${log.date || '—'}</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">${log.isLotReturn ? `Lot #${log.lotId}` : 'Quick Return'}</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">${log.designInfo?.style || log.category || '—'}</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">${itemsText}</td>
          <td style="border: 1px solid #000; padding: 6px 8px; text-align: right; font-weight: bold;">${log.totalQty}</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">${log.personName || '—'}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Material Return History Audit Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 20px; color: #000; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
          .header h1 { margin: 0; font-size: 18px; text-transform: uppercase; }
          .header p { margin: 4px 0 0; font-size: 12px; color: #333; }
          .summary-bar { display: flex; justify-content: space-between; border: 1px solid #000; padding: 8px 12px; font-size: 12px; margin-bottom: 14px; font-weight: bold; background: #f5f5f5; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { border: 1.5px solid #000; padding: 7px 8px; background: #eee; text-align: left; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; }
          .sig-block { text-align: center; width: 180px; border-top: 1px dashed #000; padding-top: 5px; font-size: 11px; font-weight: bold; }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MATERIAL RETURN AUDIT REPORT & REGISTER</h1>
          <p>Generated on: ${new Date().toLocaleString()} | Filter: ${historyDateFilter.toUpperCase()} | Total Returns: ${filteredReturnLogs.length}</p>
        </div>
        <div class="summary-bar">
          <span>Total Vouchers: ${historyMetrics.totalReturns}</span>
          <span>Total Units Returned: ${historyMetrics.totalUnits}</span>
          <span>Lot Returns: ${historyMetrics.lotReturns} | Quick Returns: ${historyMetrics.quickReturns}</span>
          <span>Unique Materials: ${historyMetrics.uniqueMaterials}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th style="width: 80px;">Voucher #</th>
              <th style="width: 100px;">Date & Time</th>
              <th style="width: 90px;">Source</th>
              <th style="width: 90px;">Style</th>
              <th>Materials Returned</th>
              <th style="width: 70px; text-align: right;">Total Qty</th>
              <th style="width: 120px;">Reason / Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="signatures">
          <div class="sig-block">Store Clerk / Prepared By</div>
          <div class="sig-block">Warehouse Manager</div>
          <div class="sig-block">Factory Auditor</div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };



  return (
    <div className="RM_Wrap">
      <style>{`
        .rm-dropdown-card {
          background: #ffffff !important;
        }
        body.dark-theme .rm-dropdown-card {
          background: #131924 !important;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes shimmerGrad { 0% { background-position: 0% 0%; } 50% { background-position: 100% 0%; } 100% { background-position: 0% 0%; } }
        @keyframes successPop { 0% { transform: scale(0.8); opacity: 0; } 60% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
        
        .RM_Wrap {
          max-width: 100%;
          margin: 0;
          padding: 24px 20px 40px;
          box-sizing: border-box;
          font-family: var(--font-family-body, system-ui);
          color: var(--text-main, #0f172a);
          min-height: 100vh;
        }

        .RM_Hero {
          background: var(--bg-secondary, #ffffff);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 22px 28px;
          margin-bottom: 22px;
          box-shadow: 0 2px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          border: 1px solid rgba(99, 102, 241, 0.12);
          position: relative;
          overflow: hidden;
        }

        .RM_Hero::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #6366f1, #10b981, #6366f1);
          background-size: 200% 100%;
          animation: shimmerGrad 4s ease infinite;
        }

        .RM_HeroTitleSection {
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 0;
        }

        .RM_HeroIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          border-radius: 16px;
          background: linear-gradient(135deg, #6366f1 0%, #10b981 100%);
          color: white;
          font-size: 26px;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
          flex-shrink: 0;
        }

        .RM_HeroText h2 {
          margin: 0;
          font-size: 1.65rem;
          font-weight: 900;
          font-family: var(--font-family-title);
          background: linear-gradient(135deg, #312e81 0%, #6366f1 50%, #10b981 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.5px;
        }

        .RM_HeroText p {
          margin: 4px 0 0 0;
          color: var(--text-muted, #64748b);
          font-size: 0.9rem;
          font-weight: 400;
        }

        .RM_StatRow {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-shrink: 0;
        }

        .RM_StatCard {
          padding: 8px 14px;
          border-radius: 13px;
          background: var(--bg-secondary, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.02);
          transition: all 0.2s ease;
          user-select: none;
        }

        .RM_StatIcon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .RM_StatVal {
          font-size: 16px;
          font-weight: 800;
          color: var(--text-main, #0f172a);
          line-height: 1.1;
        }

        .RM_StatLabel {
          font-size: 11px;
          color: var(--text-muted, #64748b);
          margin-top: 2px;
          font-weight: 600;
          white-space: nowrap;
        }

        .RM_ModeContainer {
          display: inline-flex;
          align-items: center;
          background: var(--bg-secondary, #ffffff);
          border-radius: 14px;
          border: 1.5px solid var(--border-color, #e2e8f0);
          padding: 4px;
          gap: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }

        .RM_ModeBtn {
          position: relative;
          z-index: 1;
          padding: 9px 18px;
          border: none;
          cursor: pointer;
          border-radius: 10px;
          font-size: 0.88rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          color: var(--text-muted, #64748b);
          transition: all 0.2s ease;
          white-space: nowrap;
          outline: none;
        }

        .RM_ModeBtn:hover:not(.active-lot):not(.active-quick):not(.active-history) {
          color: var(--text-main, #0f172a);
          background: rgba(0, 0, 0, 0.04);
        }

        .RM_ModeBtn.active-lot {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #ffffff !important;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.32);
        }

        .RM_ModeBtn.active-quick {
          background: linear-gradient(135deg, #10b981, #059669);
          color: #ffffff !important;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.32);
        }

        .RM_ModeBtn.active-history {
          background: linear-gradient(135deg, #0ea5e9, #0284c7);
          color: #ffffff !important;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(14, 165, 233, 0.32);
        }

        .RM_TabCount {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px 7px;
          border-radius: 12px;
          font-size: 0.72rem;
          font-weight: 700;
          line-height: 1.1;
        }

        .RM_ModeBtn.active-history .RM_TabCount {
          background: rgba(255, 255, 255, 0.28);
          color: #ffffff;
        }

        .RM_ModeBtn:not(.active-history) .RM_TabCount {
          background: rgba(14, 165, 233, 0.12);
          color: #0284c7;
        }

        @media (max-width: 900px) {
          .RM_Hero {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
          .RM_StatRow {
            width: 100%;
            overflow-x: auto;
            padding-bottom: 4px;
          }
        }

        .RM_Card {
          background: var(--bg-secondary, #ffffff);
          border-radius: 18px;
          border: 1px solid var(--border-color, #e2e8f0);
          box-shadow: 0 4px 20px rgba(0,0,0,0.03);
          overflow: visible;
        }

        .RM_CardHeader {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          border-top-left-radius: 18px;
          border-top-right-radius: 18px;
        }

        .RM_CardHeaderTitle {
          font-weight: 800;
          font-size: 0.95rem;
          color: var(--text-main, #0f172a);
          font-family: var(--font-family-title);
          letter-spacing: -0.2px;
        }

        .RM_SearchBox {
          position: relative;
          flex: 1;
        }

        .RM_SearchInput {
          width: 100%;
          padding: 14px 18px 14px 46px;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 500;
          border: 1.5px solid var(--border-color, #e2e8f0);
          background: var(--bg-primary, #f8fafc);
          color: var(--text-main, #0f172a);
          outline: none;
          transition: all 0.22s ease;
        }

        .RM_SearchInput:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
          background: var(--bg-secondary, #ffffff);
        }

        .RM_BtnPrimary {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          font-weight: 700;
          font-size: 0.9rem;
          padding: 12px 24px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.22s ease;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
        }

        .RM_BtnPrimary:hover:not(:disabled) {
          transform: translateY(-1.5px);
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
        }

        .RM_BtnSuccess {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          font-weight: 700;
          font-size: 0.9rem;
          padding: 12px 28px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.22s ease;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .RM_BtnSuccess:hover:not(:disabled) {
          transform: translateY(-1.5px);
          box-shadow: 0 8px 18px rgba(16, 185, 129, 0.4);
        }

        .RM_BtnSuccess:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .RM_BtnGhost {
          padding: 12px 20px;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          border: 1.5px solid var(--border-color, #e2e8f0);
          background: transparent;
          color: var(--text-muted, #64748b);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.22s ease;
        }

        .RM_BtnGhost:hover {
          background: var(--bg-primary, #f8fafc);
          border-color: #6366f1;
          color: #6366f1;
        }

        .RM_TableInput {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1.5px solid var(--border-color, #e2e8f0);
          background: var(--bg-primary, #f8fafc);
          color: var(--text-main, #0f172a);
          outline: none;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .RM_TableInput:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
          background: var(--bg-secondary, #ffffff);
        }

        .RM_TableSelect {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1.5px solid var(--border-color, #e2e8f0);
          background: var(--bg-primary, #f8fafc);
          color: var(--text-main, #0f172a);
          outline: none;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .RM_TableSelect:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
          background: var(--bg-secondary, #ffffff);
        }

        .RM_TrashBtn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1.5px solid var(--border-color, #e2e8f0);
          background: transparent;
          color: var(--text-muted, #64748b);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .RM_TrashBtn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.4);
          color: #ef4444;
          transform: scale(1.02);
        }

        .RM_TrashBtn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .RM_StatCardInteractive {
          cursor: pointer;
          transition: all 0.22s ease;
        }
        .RM_StatCardInteractive:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.2);
          border-color: #10b981;
        }

        .RM_HistoryTableWrap {
          width: 100%;
          overflow-x: auto;
          border-radius: 14px;
          border: 1px solid var(--border-color, #e2e8f0);
          background: var(--bg-secondary, #ffffff);
          box-shadow: 0 2px 10px rgba(0,0,0,0.02);
        }
        .RM_HistoryTable {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88rem;
          text-align: left;
        }
        .RM_HistoryTable th {
          background: var(--bg-primary, #f8fafc);
          padding: 12px 16px;
          font-weight: 700;
          color: var(--text-muted, #64748b);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1.5px solid var(--border-color, #e2e8f0);
          white-space: nowrap;
        }
        .RM_HistoryTable td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          color: var(--text-main, #0f172a);
          vertical-align: middle;
        }
        .RM_HistoryTable tr:last-child td {
          border-bottom: none;
        }
        .RM_HistoryTable tr:hover td {
          background: rgba(99, 102, 241, 0.025);
        }
        .RM_Badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .RM_FilterPill {
          padding: 7px 14px;
          border-radius: 20px;
          border: 1.5px solid var(--border-color, #e2e8f0);
          background: var(--bg-secondary, #ffffff);
          color: var(--text-muted, #64748b);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .RM_FilterPill:hover {
          border-color: #6366f1;
          color: #6366f1;
        }
        .RM_FilterPill.active {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          border-color: #4f46e5;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
        }
      `}</style>

      {/* ── HERO HEADER ─────────────────────────────────────────────── */}
      <div className="RM_Hero">
        <div className="RM_HeroTitleSection">
          <div className="RM_HeroIcon">
            <RotateCcw size={28} color="#fff" strokeWidth={2.2} />
          </div>
          <div className="RM_HeroText">
            <h2>Return Material Center</h2>
            <p>Return excess or unused materials back to inventory stock & view audit history</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="RM_StatRow">
          {[
            { label: 'Total Materials', value: materials.length, icon: <Package size={15} />, color: '#6366f1' },
            { label: 'Issue Records', value: issueLogs.filter(l => !l.isReturn).length, icon: <FileText size={15} />, color: '#f59e0b' },
            {
              label: 'Return Records',
              value: returnLogs.length,
              icon: <RotateCcw size={15} />,
              color: '#10b981',
              isClickable: true,
              onClick: () => setMode('history')
            },
          ].map((stat, i) => (
            <div
              key={i}
              className={`RM_StatCard ${stat.isClickable ? 'RM_StatCardInteractive' : ''}`}
              onClick={stat.onClick}
              style={{
                cursor: stat.isClickable ? 'pointer' : 'default',
                borderColor: stat.isClickable && mode === 'history' ? '#10b981' : undefined,
                background: stat.isClickable && mode === 'history' ? 'rgba(16,185,129,0.06)' : undefined,
                boxShadow: stat.isClickable && mode === 'history' ? '0 0 0 1.5px #10b981' : undefined
              }}
              title={stat.isClickable ? 'Click to switch to Return History & Vouchers' : undefined}
            >
              <div className="RM_StatIcon" style={{ background: `${stat.color}15`, color: stat.color }}>
                {stat.icon}
              </div>
              <div>
                <div className="RM_StatVal">{stat.value}</div>
                <div className="RM_StatLabel">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MODE TOGGLE TABS ──────────────────────────────────────── */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div className="RM_ModeContainer">
          {[
            { key: 'lot', label: 'Lot Return', icon: <Search size={15} /> },
            { key: 'quick', label: 'Quick Return', icon: <Zap size={15} /> },
            { key: 'history', label: 'Return History', icon: <RotateCcw size={15} />, count: returnLogs.length }
          ].map(m => (
            <button
              key={m.key}
              type="button"
              className={`RM_ModeBtn ${mode === m.key ? `active-${m.key}` : ''}`}
              onClick={() => {
                setMode(m.key);
                if (m.key !== 'history') {
                  setFetchedDesign(null);
                  setFetchError('');
                  setLotInput('');
                  setLotHistory([]);
                  setReturnItems([{ materialId: '', bomItemName: '', qty: '', note: '' }]);
                  setReturnNotes('');
                  setFormError('');
                  setFormSuccess('');
                }
              }}
            >
              {m.icon}
              <span>{m.label}</span>
              {m.count !== undefined && (
                <span className="RM_TabCount">{m.count}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '7px 14px',
          borderRadius: '10px',
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          fontSize: '12.5px',
          color: 'var(--text-muted, #64748b)',
          fontWeight: '500'
        }}>
          {mode === 'lot' && <><span>💡</span> <span>Auto-fetch lot BOM and pre-fill returned quantities</span></>}
          {mode === 'quick' && <><span>⚡</span> <span>Direct inventory stock return without lot linkage</span></>}
          {mode === 'history' && <><span>📋</span> <span>Audit log of all excess returned materials & voucher slips</span></>}
        </div>
      </div>

      {/* ── ALERTS ─────────────────────────────────────────────────── */}
      {formSuccess && (
        <div style={{
          animation: 'successPop 0.4s ease',
          marginBottom: '20px', padding: '16px 20px',
          borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '12px',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.1) 100%)',
          border: '1px solid rgba(16,185,129,0.3)', color: 'var(--success)'
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
            background: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <CheckCircle size={18} />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '14px' }}>Return Successful!</div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>{formSuccess}</div>
          </div>
        </div>
      )}

      {formError && (
        <div style={{
          marginBottom: '20px', padding: '14px 18px',
          borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          color: 'var(--danger)'
        }}>
          <AlertTriangle size={18} />
          <span style={{ fontWeight: '500', fontSize: '13px' }}>{formError}</span>
          <button onClick={() => setFormError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', opacity: 0.7 }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ══════════ LOT RETURN MODE ════════════════════════════════════ */}
      {mode === 'lot' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── BARCODE / QR SCANNER CARD ───────────────────────────── */}
          <div className="RM_Card" style={{ border: '1.5px solid rgba(99, 102, 241, 0.25)', background: 'var(--card-bg)' }}>
            <div className="RM_CardHeader" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#ffffff', boxShadow: '0 3px 10px rgba(99,102,241,0.3)'
                  }}>
                    <Barcode size={18} />
                  </div>
                  <div>
                    <div className="RM_CardHeaderTitle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Barcode / QR Scanner
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', fontWeight: '700' }}>
                        ● LIVE SCANNER READY
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Scan <b>Lot Barcode</b> to auto-load BOM & history, or scan <b>Material Barcode / Item Code</b> to auto-match return item
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <form onSubmit={handleBarcodeScanSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                <div className="RM_SearchBox" style={{ flex: 1 }}>
                  <Barcode size={18} style={{
                    position: 'absolute', left: '16px', top: '50%',
                    transform: 'translateY(-50%)', color: '#6366f1', pointerEvents: 'none', zIndex: 2
                  }} />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    className="RM_SearchInput"
                    placeholder="Scan Lot barcode or Material barcode (e.g. 62115, MAT-101, BTN-01)..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    style={{ paddingLeft: '44px', border: '1.5px solid rgba(99,102,241,0.3)' }}
                  />
                  {barcodeInput && (
                    <button
                      type="button"
                      onClick={() => setBarcodeInput('')}
                      style={{
                        position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="RM_BtnPrimary"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', minWidth: '130px' }}
                >
                  <Barcode size={16} />
                  Scan / Enter
                </button>
              </form>

              {barcodeScanFeedback && (
                <div style={{
                  marginTop: '14px', padding: '12px 16px', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: barcodeScanFeedback.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${barcodeScanFeedback.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  color: barcodeScanFeedback.type === 'success' ? 'var(--success)' : 'var(--danger)',
                  fontSize: '13px', fontWeight: '600', animation: 'fadeIn 0.2s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {barcodeScanFeedback.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    <span>{barcodeScanFeedback.msg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBarcodeScanFeedback(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── SEARCH CARD ────────────────────────────────────────── */}
          <div className="RM_Card">
            <div className="RM_CardHeader" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, transparent 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px',
                  background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#6366f1'
                }}>
                  <Hash size={16} />
                </div>
                <div>
                  <div className="RM_CardHeaderTitle">Search by Lot Number</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Type the lot ID or reference — details will auto-load</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                <div className="RM_SearchBox">
                  <Search size={17} style={{
                    position: 'absolute', left: '16px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 2
                  }} />
                  <input
                    ref={inputRef}
                    type="text"
                    className="RM_SearchInput"
                    placeholder="Enter lot number e.g. 11001, MH-4459..."
                    value={lotInput}
                    onChange={(e) => handleLotInputChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchLot(lotInput); } }}
                    style={{
                      border: fetchError ? '1.5px solid var(--danger)' : fetchedDesign ? '1.5px solid var(--success)' : undefined
                    }}
                  />
                  {isFetching ? (
                    <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        border: '2px solid var(--border-color)',
                        borderTopColor: '#6366f1',
                        animation: 'spin 0.7s linear infinite'
                      }} />
                    </div>
                  ) : fetchedDesign ? (
                    <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--success)', zIndex: 2 }}>
                      <CheckCircle size={18} />
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="RM_BtnPrimary"
                  onClick={() => fetchLot(lotInput)}
                >
                  <Search size={16} />
                  Fetch Lot
                </button>
              </div>

              {fetchError && (
                <div style={{
                  marginTop: '12px', padding: '12px 16px',
                  backgroundColor: 'rgba(239,68,68,0.08)', color: 'var(--danger)',
                  borderRadius: '10px', fontSize: '13px', display: 'flex',
                  alignItems: 'center', gap: '8px', fontWeight: '500',
                  border: '1px solid rgba(239,68,68,0.2)'
                }}>
                  <AlertTriangle size={14} />
                  {fetchError}
                </div>
              )}
            </div>
          </div>

          {/* ── LOT INFO CARD ──────────────────────────────────────── */}
          {fetchedDesign && (
            <div className="animate-fade" style={{
              borderRadius: '18px', overflow: 'hidden',
              border: '1px solid rgba(99,102,241,0.2)',
              background: 'var(--card-bg)',
              boxShadow: '0 4px 24px rgba(99,102,241,0.1)'
            }}>
              {/* Lot Header Banner */}
              <div style={{
                padding: '24px 28px',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)',
                borderBottom: '1px solid rgba(99,102,241,0.12)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    background: fetchedDesign.colorCode || 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 6px 16px rgba(99,102,241,0.25)',
                    border: '2px solid rgba(255,255,255,0.2)'
                  }}>
                    <Package size={24} color="#fff" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: 'var(--font-family-title)', fontSize: '22px',
                        fontWeight: '800', color: 'var(--text-color)'
                      }}>
                        Lot #{fetchedDesign.id}
                      </span>
                      {fetchedDesign.lotNo2 && (
                        <span style={{
                          padding: '3px 10px', borderRadius: '20px', fontSize: '12px',
                          fontWeight: '600', backgroundColor: 'rgba(99,102,241,0.12)',
                          color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)'
                        }}>
                          {fetchedDesign.lotNo2}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {fetchedDesign.name || 'Unnamed Design'}
                    </div>
                  </div>
                </div>
                <span style={{
                  padding: '8px 18px', borderRadius: '20px', fontSize: '12px',
                  fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em',
                  backgroundColor: fetchedDesign.status === 'Approved' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                  color: fetchedDesign.status === 'Approved' ? 'var(--success)' : 'var(--warning)',
                  border: `1px solid ${fetchedDesign.status === 'Approved' ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`
                }}>
                  ● {fetchedDesign.status || 'Pending'}
                </span>
              </div>

              {/* Design Details Grid */}
              <div style={{
                padding: '20px 28px',
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '16px', borderBottom: '1px solid var(--border-color)'
              }}>
                {[
                  { icon: <Tag size={13} />, label: 'Brand', value: fetchedDesign.brand || '—', color: '#6366f1' },
                  { icon: <Layers size={13} />, label: 'Category', value: fetchedDesign.category || '—', color: '#8b5cf6' },
                  { icon: <User size={13} />, label: 'Designer', value: fetchedDesign.designer || '—', color: '#ec4899' },
                  { icon: <Calendar size={13} />, label: 'Date', value: fetchedDesign.date || '—', color: '#f59e0b' },
                  { icon: <Box size={13} />, label: 'Qty', value: fetchedDesign.quantity ? `${fetchedDesign.quantity} pcs` : '—', color: '#10b981' },
                  { icon: <Hash size={13} />, label: 'Style', value: fetchedDesign.style || '—', color: '#3b82f6' },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: '12px 14px', borderRadius: '12px',
                    background: `${item.color}08`,
                    border: `1px solid ${item.color}15`
                  }}>
                    <span style={{
                      fontSize: '11px', fontWeight: '600', color: item.color,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '5px'
                    }}>
                      {item.icon} {item.label}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-color)' }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* BOM Components */}
              {bomItems.length > 0 && (
                <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{
                    fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <Layers size={13} />
                    BOM Components ({bomItems.length})
                    <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-muted)', marginLeft: '6px' }}>(Click to jump/highlight in return list)</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {bomItems.map((b, i) => {
                      const rowIndex = returnItems.findIndex(
                        item => (item.bomItemName || '').toLowerCase().trim() === b.name.toLowerCase().trim()
                      );
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            if (rowIndex !== -1) {
                              setHighlightedRowIndex(rowIndex);
                              setTimeout(() => setHighlightedRowIndex(null), 3000);
                            } else {
                              const newIdx = returnItems.length;
                              setReturnItems(prev => [
                                ...prev,
                                {
                                  materialId: b.materialId || '',
                                  bomItemName: b.name,
                                  qty: '',
                                  note: b.detail ? `BOM Req: ${b.detail}` : ''
                                }
                              ]);
                              setHighlightedRowIndex(newIdx);
                              setTimeout(() => setHighlightedRowIndex(null), 3000);
                            }
                          }}
                          style={{
                            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                            backgroundColor: rowIndex !== -1 ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)',
                            color: '#6366f1',
                            border: '1px solid rgba(99,102,241,0.22)',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                          }}
                          title={`Click to focus or add ${b.name} in return table`}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                          {b.name} {b.detail ? `× ${b.detail}` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Issue History Toggle */}
              {lotHistory.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    style={{
                      width: '100%', padding: '14px 28px', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '13px', fontWeight: '600', color: '#6366f1',
                      fontFamily: 'var(--font-family)', transition: 'background 0.2s'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={14} />
                      Issue History ({lotHistory.length} record{lotHistory.length > 1 ? 's' : ''})
                    </span>
                    {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {showHistory && (
                    <div className="animate-fade" style={{ padding: '0 28px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {lotHistory.map((log, i) => (
                          <div key={i} className="rm-history-item" style={{
                            padding: '14px 18px', borderRadius: '12px',
                            backgroundColor: 'var(--bg-color)',
                            border: '1px solid var(--border-color)',
                            fontSize: '13px', transition: 'all 0.2s'
                          }}>
                            <div style={{
                              display: 'flex', justifyContent: 'space-between',
                              alignItems: 'center', marginBottom: '10px'
                            }}>
                              <span style={{ fontWeight: '700', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                                #{log.id}
                                {log.isReissue && (
                                  <span style={{
                                    fontSize: '10px', padding: '2px 8px', borderRadius: '4px',
                                    backgroundColor: 'rgba(245,158,11,0.12)', color: 'var(--warning)', fontWeight: '700'
                                  }}>RE-ISSUE</span>
                                )}
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{log.date}</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {log.materials?.map((m, j) => (
                                <span key={j} style={{
                                  padding: '4px 10px', borderRadius: '6px',
                                  fontSize: '11px', fontWeight: '600',
                                  backgroundColor: 'rgba(99,102,241,0.08)', color: '#6366f1',
                                  border: '1px solid rgba(99,102,241,0.15)'
                                }}>
                                  {m.bomItemName || m.name}: {m.qty} {m.unit}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── RETURN FORM (Lot Mode) ─────────────────────────────── */}
          {fetchedDesign && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Materials Table Card */}
              <div className="RM_Card">
                {/* Card Header */}
                <div className="RM_CardHeader" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, transparent 100%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '9px',
                      background: 'rgba(16,185,129,0.08)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'var(--success)'
                    }}>
                      <RotateCcw size={15} />
                    </div>
                    <div>
                      <span className="RM_CardHeaderTitle">
                        Materials to Return
                      </span>
                      {bomItems.length > 0 && (
                        <span style={{
                          marginLeft: '10px', fontSize: '11px', fontWeight: '700',
                          color: '#6366f1', background: 'rgba(99,102,241,0.1)',
                          padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(99,102,241,0.2)'
                        }}>
                          ● ONLY BOM ITEMS ({bomItems.length})
                        </span>
                      )}
                      {filledItems > 0 && (
                        <span style={{
                          marginLeft: '8px', fontSize: '12px', fontWeight: '600',
                          color: 'var(--success)', background: 'rgba(16,185,129,0.12)',
                          padding: '2px 8px', borderRadius: '20px'
                        }}>
                          {filledItems} ready · {totalReturnQty} units
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="RM_BtnGhost"
                    onClick={handleAddRow}
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    <Plus size={14} />
                    Add Row
                  </button>
                </div>

                {/* Column Headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1.6fr 110px 100px 44px',
                  gap: '12px', padding: '12px 24px',
                  fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.8px',
                  backgroundColor: 'var(--bg-primary, #f8fafc)',
                  borderBottom: '1px solid var(--border-color, #e2e8f0)'
                }}>
                  <div>BOM Component</div>
                  <div>Inventory Material</div>
                  <div>Return Qty</div>
                  <div>Issued Ref</div>
                  <div></div>
                </div>

                {/* Rows */}
                <div>
                  {returnItems.map((item, index) => {
                    const selectedMaterial = materials.find(m => m.id === item.materialId);
                    const issuedQtyForMat = selectedMaterial
                      ? getIssuedQty(
                          selectedMaterial.color && selectedMaterial.color !== 'Default'
                            ? `${selectedMaterial.name} (${selectedMaterial.color})`
                            : selectedMaterial.name
                        )
                      : 0;
                    const isHovered = hoveredRow === index;
                    const isHighlighted = highlightedRowIndex === index;

                    return (
                      <div
                        key={index}
                        onMouseEnter={() => setHoveredRow(index)}
                        onMouseLeave={() => setHoveredRow(null)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.4fr 1.6fr 110px 100px 44px',
                          gap: '12px', alignItems: 'center',
                          padding: '12px 24px',
                          borderBottom: index < returnItems.length - 1 ? '1px solid var(--border-color)' : 'none',
                          background: isHighlighted
                            ? 'rgba(16,185,129,0.12)'
                            : isHovered
                              ? 'rgba(99,102,241,0.03)'
                              : 'transparent',
                          boxShadow: isHighlighted ? 'inset 0 0 0 1.5px rgba(16,185,129,0.5)' : undefined,
                          transition: 'background 0.2s, box-shadow 0.2s'
                        }}
                      >
                        {/* BOM Component (Strictly BOM items only) */}
                        <div>
                          {bomItems.length > 0 ? (
                            <select
                              className="RM_TableInput"
                              value={item.bomItemName || ''}
                              onChange={(e) => handleItemChange(index, 'bomItemName', e.target.value)}
                              style={{ cursor: 'pointer', fontWeight: '600' }}
                            >
                              <option value="">— Select BOM Component —</option>
                              {bomItems.map((b, bi) => (
                                <option key={bi} value={b.name}>
                                  {b.name} {b.detail ? `(${b.detail})` : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              className="RM_TableInput"
                              placeholder="Component name..."
                              value={item.bomItemName || ''}
                              onChange={(e) => handleItemChange(index, 'bomItemName', e.target.value)}
                            />
                          )}
                        </div>

                        {/* Inventory Material */}
                        <div>
                          <SearchableMaterialSelect
                            materials={materials}
                            value={item.materialId}
                            onChange={(val) => handleItemChange(index, 'materialId', val)}
                          />
                        </div>

                        {/* Return Qty */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <input
                            type="number" step="any" min="0.01"
                            placeholder="0"
                            className="RM_TableInput"
                            value={item.qty}
                            onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                            required
                            style={{ textAlign: 'center' }}
                          />
                          {selectedMaterial && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, fontWeight: '600' }}>
                              {selectedMaterial.unit}
                            </span>
                          )}
                        </div>

                        {/* Issued Ref */}
                        <div style={{
                          fontSize: '12px', fontWeight: '600',
                          color: issuedQtyForMat > 0 ? '#6366f1' : 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          {issuedQtyForMat > 0 ? (
                            <>
                              <Info size={12} />
                              {issuedQtyForMat} {selectedMaterial?.unit || ''}
                            </>
                          ) : '—'}
                        </div>

                        {/* Remove Button */}
                        <button
                          type="button"
                          className="RM_TrashBtn"
                          onClick={() => handleRemoveRow(index)}
                          disabled={returnItems.length === 1}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes Card */}
              <div style={{
                borderRadius: '16px', padding: '20px 24px',
                border: '1px solid var(--border-color)', background: 'var(--card-bg)'
              }}>
                <label style={{
                  fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <FileText size={13} />
                  Return Reason / Notes
                </label>
                <textarea
                  className="form-input"
                  placeholder="e.g. Leftover fabric rolls returned after production completion..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={3}
                  style={{ borderRadius: '10px', fontSize: '14px', resize: 'vertical' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                <button
                  type="button"
                  className="RM_BtnGhost"
                  onClick={() => {
                    setFetchedDesign(null);
                    setLotInput('');
                    setLotHistory([]);
                    setReturnItems([{ materialId: '', bomItemName: '', qty: '', note: '' }]);
                    setReturnNotes('');
                    setFormError('');
                  }}
                >
                  <ArrowLeft size={16} />
                  Clear & Reset
                </button>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {filledItems > 0 && (
                    <div style={{
                      padding: '10px 18px', borderRadius: '10px',
                      background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                      fontSize: '13px', fontWeight: '600', color: 'var(--success)'
                    }}>
                      <BarChart3 size={14} style={{ marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />
                      {filledItems} items · {totalReturnQty} total units
                    </div>
                  )}
                  <button
                    type="submit"
                    className="RM_BtnSuccess"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div style={{
                          width: '16px', height: '16px', borderRadius: '50%',
                          border: '2px solid rgba(255,255,255,0.4)',
                          borderTopColor: '#fff', animation: 'spin 0.7s linear infinite'
                        }} />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={18} />
                        Submit Return
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ── EMPTY STATE ─────────────────────────────────────────── */}
          {!fetchedDesign && !fetchError && (
            <div style={{
              textAlign: 'center', padding: '80px 24px',
              borderRadius: '20px', border: '2px dashed var(--border-color)',
              background: 'var(--bg-secondary, #ffffff)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.01)'
            }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '24px',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.06) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', border: '1px solid rgba(99,102,241,0.15)'
              }}>
                <Search size={36} style={{ color: '#6366f1' }} />
              </div>
              <p style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--text-main)', margin: '0 0 8px', letterSpacing: '-0.3px' }}>
                Search for a Lot to Begin
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '380px', margin: '0 auto', lineHeight: 1.6 }}>
                Enter a lot number like{' '}
                <code style={{
                  padding: '3px 8px', borderRadius: '6px',
                  backgroundColor: 'rgba(99,102,241,0.08)', color: '#6366f1', fontWeight: '700',
                  fontSize: '0.9rem'
                }}>11001</code>
                {' '}and all issued materials will be auto-populated for return.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════════ QUICK RETURN MODE ══════════════════════════════════ */}
      {mode === 'quick' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Info Banner */}
          <div style={{
            padding: '18px 24px', borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.04) 100%)',
            border: '1px solid rgba(16,185,129,0.2)',
            display: 'flex', alignItems: 'flex-start', gap: '14px',
            boxShadow: '0 4px 12px rgba(16,185,129,0.02)'
          }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
              background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--success)'
            }}>
              <Zap size={18} />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#059669', marginBottom: '4px' }}>
                Quick Return Mode
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, fontWeight: '500' }}>
                Return materials directly to inventory without lot or BOM mapping. Ideal for general stock returns, adjustments, or corrections.
              </div>
            </div>
          </div>

          {/* Materials Table */}
          <div className="RM_Card">
            {/* Header */}
            <div className="RM_CardHeader" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, transparent 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '9px',
                  background: 'rgba(16,185,129,0.08)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--success)'
                }}>
                  <TrendingDown size={15} />
                </div>
                <div>
                  <span className="RM_CardHeaderTitle">
                    Return Items
                  </span>
                  {filledItems > 0 && (
                    <span style={{
                      marginLeft: '10px', fontSize: '12px', fontWeight: '600',
                      color: 'var(--success)', background: 'rgba(16,185,129,0.1)',
                      padding: '2px 8px', borderRadius: '20px'
                    }}>
                      {filledItems} ready · {totalReturnQty} units
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="RM_BtnGhost"
                onClick={handleAddRow}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                <Plus size={14} />
                Add Row
              </button>
            </div>

            {/* Column Headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2.5fr 130px 44px',
              gap: '12px', padding: '12px 24px',
              fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.8px',
              backgroundColor: 'var(--bg-primary, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)'
            }}>
              <div>Inventory Material</div>
              <div>Return Qty</div>
              <div></div>
            </div>

            {/* Rows */}
            <div>
              {returnItems.map((item, index) => {
                const selectedMaterial = materials.find(m => m.id === item.materialId);
                const isHovered = hoveredRow === index;
                return (
                  <div
                    key={index}
                    onMouseEnter={() => setHoveredRow(index)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      display: 'grid', gridTemplateColumns: '2.5fr 130px 44px',
                      gap: '12px', alignItems: 'center',
                      padding: '12px 24px',
                      borderBottom: index < returnItems.length - 1 ? '1px solid var(--border-color)' : 'none',
                      background: isHovered ? 'rgba(16,185,129,0.02)' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                  >
                    {/* Material */}
                    <div>
                      <SearchableMaterialSelect
                        materials={materials}
                        value={item.materialId}
                        onChange={(val) => handleItemChange(index, 'materialId', val)}
                      />
                    </div>

                    {/* Qty */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <input
                        type="number" step="any" min="0.01"
                        placeholder="0"
                        className="RM_TableInput"
                        value={item.qty}
                        onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                        required
                        style={{ textAlign: 'center' }}
                      />
                      {selectedMaterial && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, fontWeight: '600' }}>
                          {selectedMaterial.unit}
                        </span>
                      )}
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      className="RM_TrashBtn"
                      onClick={() => handleRemoveRow(index)}
                      disabled={returnItems.length === 1}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div style={{
            borderRadius: '16px', padding: '20px 24px',
            border: '1px solid var(--border-color)', background: 'var(--card-bg)'
          }}>
            <label style={{
              fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <FileText size={13} />
              Return Reason / Notes
            </label>
            <textarea
              className="form-input"
              placeholder="e.g. Returned unused thread spools and leftover zippers to warehouse..."
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              rows={3}
              style={{ borderRadius: '10px', fontSize: '14px', resize: 'vertical' }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
            <button
              type="button"
              className="RM_BtnGhost"
              onClick={() => {
                setReturnItems([{ materialId: '', bomItemName: '', qty: '', note: '' }]);
                setReturnNotes('');
                setFormError('');
              }}
            >
              <X size={16} />
              Clear All
            </button>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {filledItems > 0 && (
                <div style={{
                  padding: '10px 18px', borderRadius: '10px',
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                  fontSize: '13px', fontWeight: '600', color: 'var(--success)'
                }}>
                  <BarChart3 size={14} style={{ marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />
                  {filledItems} items · {totalReturnQty} total units
                </div>
              )}
              <button
                type="submit"
                className="RM_BtnSuccess"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: '#fff', animation: 'spin 0.7s linear infinite'
                    }} />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    Submit Quick Return
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ══════════ RETURN HISTORY MODE ════════════════════════════════ */}
      {mode === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

          {/* ── RETURN HISTORY METRICS STRIP ──────────────────────────── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            {[
              {
                label: 'Total Return Vouchers',
                value: historyMetrics.totalReturns,
                subtext: `out of ${returnLogs.length} total logs`,
                icon: <FileText size={18} />,
                color: '#6366f1',
                bg: 'rgba(99, 102, 241, 0.08)'
              },
              {
                label: 'Total Units Returned',
                value: historyMetrics.totalUnits,
                subtext: 'returned to warehouse stock',
                icon: <RotateCcw size={18} />,
                color: '#10b981',
                bg: 'rgba(16, 185, 129, 0.08)'
              },
              {
                label: 'Lot Returns vs Direct',
                value: `${historyMetrics.lotReturns} / ${historyMetrics.quickReturns}`,
                subtext: `${historyMetrics.lotReturns} Lot · ${historyMetrics.quickReturns} Quick`,
                icon: <Layers size={18} />,
                color: '#0ea5e9',
                bg: 'rgba(14, 165, 233, 0.08)'
              },
              {
                label: 'Unique Materials Returned',
                value: historyMetrics.uniqueMaterials,
                subtext: 'distinct accessory items',
                icon: <Package size={18} />,
                color: '#f59e0b',
                bg: 'rgba(245, 158, 11, 0.08)'
              }
            ].map((kpi, idx) => (
              <div
                key={idx}
                className="RM_Card"
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg, #ffffff)'
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: kpi.bg,
                  color: kpi.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {kpi.icon}
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    {kpi.label}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px', lineHeight: 1.2 }}>
                    {kpi.value}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {kpi.subtext}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── FILTERS & ACTIONS BAR ─────────────────────────────────── */}
          <div className="RM_Card" style={{ padding: '20px 24px', background: 'var(--card-bg)' }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {/* Row 1: Search and Export / Print Buttons */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div className="RM_SearchBox" style={{ flex: '1 1 300px', maxWidth: '520px', minWidth: '260px' }}>
                  <Search size={16} style={{
                    position: 'absolute', left: '16px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none'
                  }} />
                  <input
                    type="text"
                    className="RM_SearchInput"
                    placeholder="Search by Return # (MR...), Lot #, Material, Style, Reason, Returnee..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    style={{ paddingLeft: '44px' }}
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery('')}
                      style={{
                        position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
                      }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={exportReturnHistoryToCsv}
                    disabled={filteredReturnLogs.length === 0}
                    className="RM_BtnGhost"
                    style={{ padding: '9px 16px', fontSize: '13px' }}
                    title="Export filtered return logs to CSV"
                  >
                    <Download size={14} />
                    Export CSV
                  </button>

                  <button
                    type="button"
                    onClick={printAllReturnHistory}
                    disabled={filteredReturnLogs.length === 0}
                    className="RM_BtnGhost"
                    style={{ padding: '9px 16px', fontSize: '13px', borderColor: '#6366f1', color: '#6366f1' }}
                    title="Print summary of all filtered return records"
                  >
                    <Printer size={14} />
                    Print All
                  </button>

                  {(historySearchQuery || historyDateFilter !== 'all' || historySpecificDate || historyTypeFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistorySearchQuery('');
                        setHistoryDateFilter('all');
                        setHistorySpecificDate('');
                        setHistoryTypeFilter('all');
                      }}
                      className="RM_BtnGhost"
                      style={{ padding: '9px 14px', fontSize: '12px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                    >
                      <RefreshCw size={13} />
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Date Pills & Type Filter */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color)'
              }}>
                {/* Date Filter Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
                    <Calendar size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                    Date:
                  </span>
                  {[
                    { key: 'all', label: 'All Dates' },
                    { key: 'today', label: 'Today' },
                    { key: 'yesterday', label: 'Yesterday' },
                    { key: 'last7', label: 'Last 7 Days' },
                    { key: 'thisMonth', label: 'This Month' },
                    { key: 'custom', label: 'Specific Date 📅' }
                  ].map(df => (
                    <button
                      key={df.key}
                      type="button"
                      className={`RM_FilterPill ${historyDateFilter === df.key ? 'active' : ''}`}
                      onClick={() => {
                        setHistoryDateFilter(df.key);
                        if (df.key !== 'custom') setHistorySpecificDate('');
                      }}
                    >
                      {df.label}
                    </button>
                  ))}

                  {historyDateFilter === 'custom' && (
                    <input
                      type="date"
                      value={historySpecificDate}
                      onChange={(e) => setHistorySpecificDate(e.target.value)}
                      className="form-input"
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        borderRadius: '8px',
                        border: '1.5px solid #6366f1',
                        color: 'var(--text-main)'
                      }}
                    />
                  )}
                </div>

                {/* Return Mode Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <Filter size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                    Mode:
                  </span>
                  <div style={{
                    display: 'inline-flex',
                    background: 'var(--bg-primary, #f1f5f9)',
                    borderRadius: '10px',
                    padding: '3px',
                    border: '1px solid var(--border-color)'
                  }}>
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'lot', label: 'Lot Returns' },
                      { key: 'quick', label: 'Quick Returns' }
                    ].map(tf => (
                      <button
                        key={tf.key}
                        type="button"
                        onClick={() => setHistoryTypeFilter(tf.key)}
                        style={{
                          border: 'none',
                          background: historyTypeFilter === tf.key ? '#ffffff' : 'transparent',
                          color: historyTypeFilter === tf.key ? '#0f172a' : 'var(--text-muted)',
                          boxShadow: historyTypeFilter === tf.key ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                          fontWeight: historyTypeFilter === tf.key ? '700' : '500',
                          fontSize: '12px',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.18s ease'
                        }}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RETURN HISTORY TABLE ─────────────────────────────────── */}
          <div className="RM_HistoryTableWrap">
            {filteredReturnLogs.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 24px',
                color: 'var(--text-muted)'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '18px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#6366f1'
                }}>
                  <RotateCcw size={28} />
                </div>
                <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-main)', marginBottom: '6px' }}>
                  {returnLogs.length === 0 ? 'No Material Returns Recorded Yet' : 'No Return Records Match Filters'}
                </div>
                <div style={{ fontSize: '13px', maxWidth: '400px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                  {returnLogs.length === 0
                    ? 'When you return excess materials using Lot Return or Quick Return, an audit voucher will be saved here automatically.'
                    : 'Try clearing your search query or choosing "All Dates" to view all return records.'}
                </div>
                {(historySearchQuery || historyDateFilter !== 'all' || historySpecificDate || historyTypeFilter !== 'all') && (
                  <button
                    type="button"
                    className="RM_BtnGhost"
                    onClick={() => {
                      setHistorySearchQuery('');
                      setHistoryDateFilter('all');
                      setHistorySpecificDate('');
                      setHistoryTypeFilter('all');
                    }}
                    style={{ margin: '0 auto', fontSize: '13px' }}
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <table className="RM_HistoryTable">
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Voucher #</th>
                    <th style={{ width: '150px' }}>Date & Time</th>
                    <th style={{ width: '170px' }}>Return Mode & Lot</th>
                    <th>Returned Materials</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Total Qty</th>
                    <th style={{ width: '220px' }}>Reason / Remarks</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturnLogs.map((log) => {
                    const isCopied = copiedVoucherId === log.id;
                    return (
                      <tr key={log.id}>
                        {/* Voucher ID */}
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              className="RM_Badge"
                              style={{
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: '#4f46e5',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                fontFamily: 'monospace',
                                fontSize: '12px'
                              }}
                            >
                              {log.id}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyVoucherId(log.id)}
                              title={isCopied ? 'Copied!' : 'Copy Voucher ID'}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '2px',
                                color: isCopied ? 'var(--success)' : 'var(--text-muted)'
                              }}
                            >
                              {isCopied ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Calendar size={12} color="var(--text-muted)" />
                              {log.date ? log.date.split(' ')[0] : '—'}
                            </span>
                            {log.date && log.date.split(' ')[1] && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Clock size={11} />
                                {log.date.split(' ').slice(1).join(' ')}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Return Mode & Lot Info */}
                        <td>
                          {log.isLotReturn ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span
                                className="RM_Badge"
                                style={{
                                  background: 'rgba(99, 102, 241, 0.1)',
                                  color: '#6366f1',
                                  width: 'fit-content'
                                }}
                              >
                                <Search size={11} />
                                Lot #{log.lotId}
                              </span>
                              {(log.designInfo?.style || log.category) && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>
                                  {log.designInfo?.style || log.category}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span
                                className="RM_Badge"
                                style={{
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  color: '#059669',
                                  width: 'fit-content'
                                }}
                              >
                                <Zap size={11} />
                                Quick Return
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Returned Materials List */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {log.parsedMaterials && log.parsedMaterials.length > 0 ? (
                              log.parsedMaterials.map((mat, mIdx) => (
                                <div
                                  key={mIdx}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    flexWrap: 'wrap',
                                    padding: '4px 8px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-primary, #f8fafc)',
                                    border: '1px solid var(--border-color)'
                                  }}
                                >
                                  <span style={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-main)' }}>
                                    {mat.name || 'Unknown Material'}
                                  </span>
                                  {mat.bomItemName && mat.bomItemName !== 'Return' && mat.bomItemName !== 'General Return' && (
                                    <span style={{
                                      fontSize: '10px',
                                      padding: '1px 6px',
                                      borderRadius: '6px',
                                      background: 'rgba(99, 102, 241, 0.1)',
                                      color: '#6366f1',
                                      fontWeight: '600'
                                    }}>
                                      {mat.bomItemName}
                                    </span>
                                  )}
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: '800',
                                    color: '#059669',
                                    marginLeft: 'auto',
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    padding: '2px 8px',
                                    borderRadius: '6px'
                                  }}>
                                    +{mat.qty} {mat.unit || 'pcs'}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                            )}
                          </div>
                        </td>

                        {/* Total Qty */}
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-block',
                            fontWeight: '800',
                            fontSize: '13px',
                            color: '#059669',
                            background: 'rgba(16, 185, 129, 0.08)',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(16, 185, 129, 0.2)'
                          }}>
                            +{log.totalQty} units
                          </span>
                        </td>

                        {/* Reason / Remarks */}
                        <td>
                          <div style={{
                            fontSize: '12px',
                            color: log.personName ? 'var(--text-main)' : 'var(--text-muted)',
                            lineHeight: 1.4,
                            maxWidth: '240px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {log.personName || '—'}
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedReturnSlip(log)}
                              className="RM_BtnGhost"
                              style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '8px' }}
                              title="View formal Return Slip voucher"
                            >
                              <Eye size={13} />
                              Slip
                            </button>
                            <button
                              type="button"
                              onClick={() => printReturnVoucher(log)}
                              className="RM_BtnGhost"
                              style={{ padding: '6px 9px', fontSize: '11px', borderRadius: '8px', color: '#6366f1', borderColor: 'rgba(99,102,241,0.3)' }}
                              title="Print return slip voucher"
                            >
                              <Printer size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════ RETURN VOUCHER SLIP MODAL ══════════════════════════ */}
      {selectedReturnSlip && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary, #ffffff)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideUp 0.25s ease'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(16,185,129,0.04) 100%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1, #10b981)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff'
                }}>
                  <RotateCcw size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-main)' }}>
                    Material Return Voucher (MRV)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Voucher ID: <strong style={{ color: '#6366f1', fontFamily: 'monospace' }}>#{selectedReturnSlip.id}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReturnSlip(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: '6px', borderRadius: '8px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Meta Grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px',
                padding: '14px 18px', borderRadius: '12px',
                background: 'var(--bg-primary, #f8fafc)', border: '1px solid var(--border-color)',
                fontSize: '13px'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>DATE & TIME</span>
                  <strong>{selectedReturnSlip.date || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>RETURN MODE</span>
                  <strong>{selectedReturnSlip.isLotReturn ? `Lot Return (#${selectedReturnSlip.lotId})` : 'Quick / Direct Return'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>STYLE / GARMENT</span>
                  <strong>{selectedReturnSlip.designInfo?.style || selectedReturnSlip.category || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>TOTAL RETURN UNITS</span>
                  <strong style={{ color: '#059669' }}>+{selectedReturnSlip.totalQty} units</strong>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Returned Material Details
                </div>
                <div style={{ borderRadius: '10px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-primary, #f8fafc)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '40px', color: 'var(--text-muted)', fontSize: '11px' }}>#</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px' }}>Material</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px' }}>BOM Component</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', width: '110px', color: 'var(--text-muted)', fontSize: '11px' }}>Qty</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '70px', color: 'var(--text-muted)', fontSize: '11px' }}>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedReturnSlip.parsedMaterials || []).map((m, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--text-main)' }}>{m.name || 'Material'}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{m.bomItemName || 'Return'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>+{m.qty}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>{m.unit || 'pcs'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              <div style={{
                padding: '12px 16px', borderRadius: '10px',
                background: 'var(--bg-primary, #f8fafc)', border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Return Remarks & Reason:
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                  {selectedReturnSlip.personName || 'Excess unused materials returned back to warehouse inventory stock.'}
                </div>
              </div>

              {/* Signatures Preview */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                paddingTop: '28px', marginTop: '10px',
                borderTop: '1px dashed var(--border-color)',
                textAlign: 'center', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)'
              }}>
                <div style={{ width: '160px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                  Returned By (Floor)
                </div>
                <div style={{ width: '160px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                  Store In-Charge (Receiver)
                </div>
                <div style={{ width: '160px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                  Authorized Signatory
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: 'var(--bg-secondary)'
            }}>
              <button
                type="button"
                className="RM_BtnGhost"
                onClick={() => setSelectedReturnSlip(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="RM_BtnPrimary"
                onClick={() => printReturnVoucher(selectedReturnSlip)}
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
              >
                <Printer size={15} />
                Print Voucher Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
