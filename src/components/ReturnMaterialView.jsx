import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RotateCcw, Search, Package, AlertTriangle, CheckCircle,
  Plus, Trash2, X, Layers, Info, Zap, Clock,
  ChevronDown, ChevronUp, Hash, Tag, User, Calendar, Box,
  TrendingDown, FileText, BarChart3, ArrowLeft
} from 'lucide-react';

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
        d => String(d.id) === id || (d.lotNo2 && d.lotNo2.toLowerCase() === id.toLowerCase())
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

        if (logsForLot.length > 0) {
          const issuedMaterials = [];
          const seen = new Set();
          logsForLot.forEach(log => {
            if (log.materials) {
              log.materials.forEach(m => {
                const key = `${m.bomItemName || 'General'}_${m.name}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  const mat = materials.find(mat => {
                    const mName = mat.color && mat.color !== 'Default'
                      ? `${mat.name} (${mat.color})`
                      : mat.name;
                    return mName === m.name;
                  });
                  issuedMaterials.push({
                    materialId: mat ? mat.id : '',
                    bomItemName: m.bomItemName || '',
                    qty: '',
                    note: `Issued: ${m.qty} ${m.unit || 'pcs'}`
                  });
                }
              });
            }
          });
          if (issuedMaterials.length > 0) {
            setReturnItems(issuedMaterials);
          }
        }
      }
      setIsFetching(false);
    }, 300);
  }, [designs, issueLogs, materials]);

  const debounceTimer = useRef(null);
  const handleLotInputChange = (val) => {
    setLotInput(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchLot(val);
    }, 500);
  };

  const handleAddRow = () => {
    setReturnItems(prev => [...prev, { materialId: '', bomItemName: '', qty: '', note: '' }]);
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

  const bomItems = fetchedDesign?.bom?.filter(b => String(b.status).toLowerCase() === 'yes') || [];
  const totalReturnQty = returnItems.reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0);
  const filledItems = returnItems.filter(i => i.materialId && parseFloat(i.qty) > 0).length;



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
          padding: 28px 32px;
          margin-bottom: 24px;
          box-shadow: 0 2px 20px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 24px;
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
          gap: 20px;
        }

        .RM_HeroIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: linear-gradient(135deg, #6366f1 0%, #10b981 100%);
          color: white;
          font-size: 26px;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
          flex-shrink: 0;
        }

        .RM_HeroText h2 {
          margin: 0;
          font-size: 1.75rem;
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
          font-size: 0.95rem;
          font-weight: 400;
        }

        .RM_StatRow {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .RM_StatCard {
          padding: 12px 18px;
          border-radius: 14px;
          background: var(--bg-secondary, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }

        .RM_StatIcon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .RM_StatVal {
          font-size: 18px;
          font-weight: 800;
          color: var(--text-main, #0f172a);
          line-height: 1;
        }

        .RM_StatLabel {
          font-size: 11px;
          color: var(--text-muted, #64748b);
          margin-top: 2px;
          font-weight: 500;
        }

        .RM_ModeContainer {
          display: inline-flex;
          background: var(--bg-secondary, #ffffff);
          border-radius: 14px;
          border: 1.5px solid var(--border-color, #e2e8f0);
          padding: 4px;
          position: relative;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }

        .RM_ModePill {
          position: absolute;
          top: 4px;
          bottom: 4px;
          border-radius: 10px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .RM_ModeBtn {
          position: relative;
          z-index: 1;
          padding: 10px 24px;
          border: none;
          cursor: pointer;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          transition: color 0.25s ease;
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
      `}</style>

      {/* ── HERO HEADER ─────────────────────────────────────────────── */}
      <div className="RM_Hero">
        <div className="RM_HeroTitleSection">
          <div className="RM_HeroIcon">
            <RotateCcw size={28} color="#fff" strokeWidth={2.2} />
          </div>
          <div className="RM_HeroText">
            <h2>Return Material Center</h2>
            <p>Return excess or unused materials back to inventory stock</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="RM_StatRow">
          {[
            { label: 'Total Materials', value: materials.length, icon: <Package size={15} />, color: '#6366f1' },
            { label: 'Issue Records', value: issueLogs.filter(l => !l.isReturn).length, icon: <FileText size={15} />, color: '#f59e0b' },
            { label: 'Return Records', value: issueLogs.filter(l => l.isReturn).length, icon: <RotateCcw size={15} />, color: '#10b981' },
          ].map((stat, i) => (
            <div key={i} className="RM_StatCard">
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

      {/* ── MODE TOGGLE (Pill) ──────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <div className="RM_ModeContainer">
          {/* Animated pill indicator */}
          <div className="RM_ModePill" style={{
            left: mode === 'lot' ? '4px' : 'calc(50% + 0px)',
            width: 'calc(50% - 4px)',
            background: mode === 'lot'
              ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
              : 'linear-gradient(135deg, #10b981, #059669)',
            boxShadow: mode === 'lot'
              ? '0 4px 14px rgba(99,102,241,0.3)'
              : '0 4px 14px rgba(16,185,129,0.3)'
          }} />

          {[
            { key: 'lot', label: 'Lot Return', icon: <Search size={15} /> },
            { key: 'quick', label: 'Quick Return', icon: <Zap size={15} /> }
          ].map(m => (
            <button
              key={m.key}
              type="button"
              className="RM_ModeBtn"
              onClick={() => {
                setMode(m.key);
                setFetchedDesign(null);
                setFetchError('');
                setLotInput('');
                setLotHistory([]);
                setReturnItems([{ materialId: '', bomItemName: '', qty: '', note: '' }]);
                setReturnNotes('');
                setFormError('');
                setFormSuccess('');
                setShowHistory(false);
              }}
              style={{ color: mode === m.key ? '#fff' : 'var(--text-muted)' }}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          marginLeft: '16px', fontSize: '13px', color: 'var(--text-muted)',
          verticalAlign: 'middle', fontWeight: '500'
        }}>
          {mode === 'lot'
            ? '↳ Auto-fetch lot details and pre-fill materials'
            : '↳ Direct inventory return without lot mapping'}
        </span>
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
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {bomItems.map((b, i) => (
                      <span key={i} style={{
                        padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                        backgroundColor: 'rgba(99,102,241,0.08)', color: '#6366f1',
                        border: '1px solid rgba(99,102,241,0.18)',
                        display: 'flex', alignItems: 'center', gap: '5px'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                        {b.name} {b.detail ? `× ${b.detail}` : ''}
                      </span>
                    ))}
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
                      {filledItems > 0 && (
                        <span style={{
                          marginLeft: '10px', fontSize: '12px', fontWeight: '600',
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
                          background: isHovered ? 'rgba(99,102,241,0.03)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        {/* BOM Component */}
                        <div>
                          <input
                            list={`bom-list-${index}`}
                            type="text"
                            className="RM_TableInput"
                            placeholder="Component name..."
                            value={item.bomItemName || ''}
                            onChange={(e) => handleItemChange(index, 'bomItemName', e.target.value)}
                          />
                          <datalist id={`bom-list-${index}`}>
                            {bomItems.map((b, bi) => (
                              <option key={bi} value={b.name} />
                            ))}
                          </datalist>
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
    </div>
  );
}
