import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Calculator, DollarSign, IndianRupee, Layers, Tag,
  Printer, Download, RefreshCw, Edit3, Check, X, AlertCircle,
  FileSpreadsheet, Sparkles, ChevronRight, ArrowUpDown, Calendar,
  User, MapPin, Eye, ExternalLink, ShieldCheck, HelpCircle
} from 'lucide-react';
import { getBackendUrl } from '../utils/api';

export default function LotCostingView({
  currencySymbol = '₹',
  currentUser = null,
  initialLotNo = '',
  onNavigateToDesign = () => {},
  onNavigateToMaterialIssue = () => {}
}) {
  const [selectedLotNo, setSelectedLotNo] = useState(initialLotNo || '');
  const [searchInput, setSearchInput] = useState(initialLotNo || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Costing Data State
  const [costingData, setCostingData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recentLots, setRecentLots] = useState([]);

  // Rate Edit Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [newRateInput, setNewRateInput] = useState('');
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Slips History Modal State
  const [activeSlipsItem, setActiveSlipsItem] = useState(null);

  // Sorting
  const [sortField, setSortField] = useState('totalCost'); // 'totalCost', 'quantity', 'rate', 'name'
  const [sortAsc, setSortAsc] = useState(false);

  const searchContainerRef = useRef(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch recent lots on mount
  useEffect(() => {
    fetchRecentLots();
  }, []);

  // Auto-load if initialLotNo given
  useEffect(() => {
    if (initialLotNo) {
      setSelectedLotNo(initialLotNo);
      setSearchInput(initialLotNo);
      fetchCostingForLot(initialLotNo);
    }
  }, [initialLotNo]);

  const fetchRecentLots = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/costing/recent-lots?limit=60`);
      if (res.ok) {
        const data = await res.json();
        setRecentLots(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Failed to fetch recent lots for costing:', err.message);
    }
  };

  const fetchCostingForLot = async (lotNo) => {
    const clean = String(lotNo || '').trim();
    if (!clean) return;

    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch(`${getBackendUrl()}/api/costing/lot/${encodeURIComponent(clean)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Could not find costing data for Lot "${clean}".`);
      }
      const data = await res.json();
      setCostingData(data);
      setSelectedLotNo(clean);
      setSearchInput(clean);
      setIsDropdownOpen(false);
    } catch (err) {
      console.error('Fetch costing error:', err.message);
      setErrorMessage(err.message);
      setCostingData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (!searchInput.trim()) return;
    fetchCostingForLot(searchInput.trim());
  };

  const handleSelectLot = (lotNo) => {
    setSearchInput(lotNo);
    setIsDropdownOpen(false);
    fetchCostingForLot(lotNo);
  };

  // Filtered suggestions based on searchInput
  const filteredSuggestions = useMemo(() => {
    const query = String(searchInput || '').toLowerCase().trim();
    if (!query) return recentLots.slice(0, 10);
    return recentLots.filter(l =>
      String(l.lotNo || '').toLowerCase().includes(query) ||
      String(l.style || '').toLowerCase().includes(query) ||
      String(l.brand || '').toLowerCase().includes(query)
    ).slice(0, 15);
  }, [searchInput, recentLots]);

  // Handle Rate Update
  const handleOpenRateModal = (item) => {
    setEditingItem(item);
    setNewRateInput(item.rate ? String(item.rate) : '');
  };

  const handleSaveRate = async () => {
    if (!editingItem) return;
    const rateVal = parseFloat(newRateInput);
    if (isNaN(rateVal) || rateVal < 0) {
      alert('Please enter a valid numeric rate (greater than or equal to 0).');
      return;
    }

    setIsSavingRate(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/costing/material-rate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: editingItem.materialId,
          materialName: editingItem.materialName,
          itemCode: editingItem.itemCode,
          rate: rateVal
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update rate');
      }

      // Update state locally and recompute
      setCostingData(prev => {
        if (!prev) return prev;
        const cuttingQty = prev.summary?.cuttingQty || 1;
        const updatedItems = prev.items.map(it => {
          if (it.key === editingItem.key) {
            const tot = Math.round((it.quantity * rateVal) * 100) / 100;
            const cpp = cuttingQty > 0 ? Math.round((tot / cuttingQty) * 1000) / 1000 : 0;
            return {
              ...it,
              rate: rateVal,
              totalCost: tot,
              costPerPiece: cpp
            };
          }
          return it;
        });

        const newTotalCost = Math.round(updatedItems.reduce((sum, it) => sum + (it.totalCost || 0), 0) * 100) / 100;
        const newCostPerPiece = cuttingQty > 0 ? Math.round((newTotalCost / cuttingQty) * 1000) / 1000 : 0;

        return {
          ...prev,
          items: updatedItems,
          summary: {
            ...prev.summary,
            totalAccessoryCost: newTotalCost,
            costPerGarmentPiece: newCostPerPiece
          }
        };
      });

      setEditingItem(null);
    } catch (err) {
      alert('Error updating rate: ' + err.message);
    } finally {
      setIsSavingRate(false);
    }
  };

  // Sorting items
  const sortedItems = useMemo(() => {
    if (!costingData?.items) return [];
    return [...costingData.items].sort((a, b) => {
      let vA = a[sortField];
      let vB = b[sortField];
      if (typeof vA === 'string') {
        return sortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      return sortAsc ? (vA - vB) : (vB - vA);
    });
  }, [costingData?.items, sortField, sortAsc]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default descending
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!costingData) return;
    const { lot, items, summary } = costingData;

    let csv = `LOT ACCESSORY COSTING SHEET - MOHIT HOSIERY\n`;
    csv += `Lot No:,${lot.lotNo},Style:,${lot.style}\n`;
    csv += `Garment Type:,${lot.garmentType},Fabric:,${lot.fabric}\n`;
    csv += `Brand:,${lot.brand},Cutting Pcs:,${lot.cuttingQty}\n`;
    csv += `Total Accessory Cost:,${currencySymbol} ${summary.totalAccessoryCost},Cost Per Piece:,${currencySymbol} ${summary.costPerGarmentPiece}\n\n`;

    csv += `#,Item Code,Material Name,Category,Location,Issued Qty,Unit,Rate (${currencySymbol}),Total Cost (${currencySymbol}),Cost Per Piece (${currencySymbol})\n`;

    items.forEach((it, idx) => {
      csv += `${idx + 1},"${it.itemCode}","${it.materialName}","${it.category}","${it.location}",${it.quantity},"${it.unit}",${it.rate},${it.totalCost},${it.costPerPiece}\n`;
    });

    csv += `\n,,,TOTALS,,${summary.totalIssuedUnits},,,"${summary.totalAccessoryCost}","${summary.costPerGarmentPiece}"\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Lot_${lot.lotNo}_Costing_Sheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Costing Sheet
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="lot-costing-container" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* ── Top Header & Actions ── */}
      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)' }}>
              <Calculator size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: 'var(--text-main, #0f172a)', letterSpacing: '-0.02em' }}>
                Admin Panel — Lot Material Costing
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted, #64748b)' }}>
                Calculate exact store material issues: Quantity × Rate = Total Cost & Cost Per Garment Piece
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {costingData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => fetchCostingForLot(selectedLotNo)}
              className="btn-refresh"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px',
                border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-secondary, #f8fafc)',
                color: 'var(--text-main, #334155)', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
              }}
              title="Refresh lot data"
            >
              <RefreshCw size={15} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px',
                border: '1px solid #10b981', background: '#ecfdf5', color: '#065f46',
                fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s'
              }}
              title="Download Excel/CSV Spreadsheet"
            >
              <Download size={15} />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handlePrint}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '10px',
                border: 'none', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#ffffff', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
              }}
              title="Print Professional Costing Sheet"
            >
              <Printer size={15} />
              <span>Print Cost Sheet</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Search & Lot Selection Bar ── */}
      <div className="no-print" style={{ background: 'var(--bg-secondary, #ffffff)', padding: '18px 20px', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', marginBottom: '24px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div ref={searchContainerRef} style={{ position: 'relative', flex: 1 }}>
            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
              <Search size={18} />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Search any Lot No (e.g. 12022, 61295, 11957, 11802) to view material costing..."
              style={{
                width: '100%',
                padding: '12px 16px 12px 42px',
                fontSize: '14.5px',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                outline: 'none',
                background: 'var(--bg-primary, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                fontWeight: '600',
                transition: 'border-color 0.15s, box-shadow 0.15s'
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setIsDropdownOpen(false);
                }}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px'
                }}
              >
                <X size={16} />
              </button>
            )}

            {/* Dropdown Suggestions */}
            {isDropdownOpen && filteredSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px',
                background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: '300px', overflowY: 'auto',
                zIndex: 1000
              }}>
                <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9' }}>
                  Select Lot Number
                </div>
                {filteredSuggestions.map((lot, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectLot(lot.lotNo)}
                    style={{
                      padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', borderBottom: '1px solid #f8fafc', transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '14px', background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '6px' }}>
                        Lot #{lot.lotNo}
                      </span>
                      <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>
                        {lot.style || 'No Style'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b' }}>
                      {lot.brand && <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{lot.brand}</span>}
                      {lot.cuttingQty > 0 && <span style={{ fontWeight: '700', color: '#0f172a' }}>{lot.cuttingQty} Pcs</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !searchInput.trim()}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '700',
              cursor: isLoading || !searchInput.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
              opacity: isLoading || !searchInput.trim() ? 0.7 : 1
            }}
          >
            {isLoading ? <RefreshCw size={16} className="spin" /> : <Search size={16} />}
            <span>View Costing</span>
          </button>
        </form>

        {/* Quick Recent Lots Chips */}
        {recentLots.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Quick Recent Lots:</span>
            {recentLots.slice(0, 8).map((l, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectLot(l.lotNo)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: selectedLotNo === l.lotNo ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                  background: selectedLotNo === l.lotNo ? '#e0e7ff' : '#f8fafc',
                  color: selectedLotNo === l.lotNo ? '#3730a3' : '#475569',
                  fontSize: '12px',
                  fontWeight: selectedLotNo === l.lotNo ? '800' : '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s'
                }}
              >
                <span>#{l.lotNo}</span>
                {l.cuttingQty > 0 && <span style={{ opacity: 0.75, fontSize: '11px' }}>({l.cuttingQty} pcs)</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Error Notification ── */}
      {errorMessage && (
        <div style={{ padding: '16px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#991b1b', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={20} color="#dc2626" />
          <span style={{ fontWeight: '600', fontSize: '14px' }}>{errorMessage}</span>
        </div>
      )}

      {/* ── Loading Spinner ── */}
      {isLoading && (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--bg-secondary, #ffffff)', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)', marginBottom: '24px' }}>
          <RefreshCw size={36} color="#4f46e5" className="spin" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#1e293b' }}>
            Aggregating All Issued Materials & Calculating Cost...
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
            Fetching from BOM issues, without BOM floor issues, extra issues, elastic, and bone slips.
          </p>
        </div>
      )}

      {/* ── Empty State Prompt (When no lot is selected) ── */}
      {!costingData && !isLoading && !errorMessage && (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--bg-secondary, #ffffff)', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#6366f1' }}>
            <Calculator size={32} />
          </div>
          <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>
            Search any Lot Number to View Complete Material Costing
          </h3>
          <p style={{ margin: '8px auto 20px', fontSize: '14px', color: '#64748b', maxWidth: '540px', lineHeight: '1.5' }}>
            Enter a Lot Number above or click any recent lot to see all materials issued from store with:
            <br />
            <strong>Quantity of material × Rate / Price = Total Cost</strong> & <strong>Cost Per Garment Piece</strong>.
          </p>

          {recentLots.length > 0 && (
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Recent Active Production Lots
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {recentLots.slice(0, 6).map((lot, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectLot(lot.lotNo)}
                    style={{
                      padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontWeight: '800', color: '#4f46e5', fontSize: '14px' }}>
                      Lot #{lot.lotNo}
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155', fontWeight: '600', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lot.style || 'Garment Production'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{lot.cuttingQty || 0} Pcs</span>
                      <span>{lot.brand || ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MAIN COSTING DASHBOARD CONTENT (When lot data is loaded) ── */}
      {costingData && !isLoading && (
        <>
          {/* Printable Sheet Company Header (Only visible when printed) */}
          <div className="print-only" style={{ display: 'none', marginBottom: '20px', borderBottom: '2px solid #0f172a', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900', letterSpacing: '-0.03em' }}>MOHIT HOSIERY</h1>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#475569' }}>Central Accessories Store & Cutting Costing Division</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', textTransform: 'uppercase', color: '#1e293b' }}>
                  Lot Material Costing Sheet
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                  Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>

          {/* ── Lot Profile Header Banner ── */}
          <div style={{
            background: 'var(--bg-secondary, #ffffff)', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)',
            padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {costingData.lot.imageUrl ? (
                  <img
                    src={costingData.lot.imageUrl}
                    alt={costingData.lot.style}
                    style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                  />
                ) : (
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '12px', background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca', fontWeight: '900', fontSize: '20px'
                  }}>
                    #{costingData.lot.lotNo.slice(-3)}
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main, #0f172a)', letterSpacing: '-0.02em' }}>
                      Lot #{costingData.lot.lotNo}
                    </span>
                    {costingData.lot.brand && (
                      <span style={{ padding: '3px 10px', borderRadius: '20px', background: '#f1f5f9', color: '#334155', fontSize: '12px', fontWeight: '700' }}>
                        {costingData.lot.brand}
                      </span>
                    )}
                    {costingData.lot.partyName && (
                      <span style={{ padding: '3px 10px', borderRadius: '20px', background: '#ecfdf5', color: '#065f46', fontSize: '12px', fontWeight: '700' }}>
                        {costingData.lot.partyName}
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: '6px', fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                    {costingData.lot.style} {costingData.lot.garmentType !== 'N/A' && `• ${costingData.lot.garmentType}`}
                  </div>
                </div>
              </div>

              {/* Lot Specs Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '13px' }}>
                <div style={{ padding: '8px 14px', borderRadius: '10px', background: 'var(--bg-primary, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Fabric</span>
                  <span style={{ fontWeight: '700', color: '#1e293b' }}>{costingData.lot.fabric}</span>
                </div>
                <div style={{ padding: '8px 14px', borderRadius: '10px', background: 'var(--bg-primary, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Supervisor</span>
                  <span style={{ fontWeight: '700', color: '#1e293b' }}>{costingData.lot.supervisor}</span>
                </div>
                <div style={{ padding: '8px 14px', borderRadius: '10px', background: 'var(--bg-primary, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Batch Pieces</span>
                  <span style={{ fontWeight: '800', color: '#4f46e5', fontSize: '15px' }}>{costingData.summary.cuttingQty.toLocaleString()} Pcs</span>
                </div>
              </div>

            </div>
          </div>

          {/* ── Executive KPI Metric Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            
            {/* 1. Total Cutting Pcs */}
            <div style={{
              background: 'var(--bg-secondary, #ffffff)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Batch Quantity
                </div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>
                  {costingData.summary.cuttingQty.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>Pcs</span>
                </div>
              </div>
            </div>

            {/* 2. Total Accessory Items */}
            <div style={{
              background: 'var(--bg-secondary, #ffffff)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Tag size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Materials Issued
                </div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>
                  {costingData.summary.totalItemsCount} <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>Items ({costingData.summary.totalIssuedUnits} units)</span>
                </div>
              </div>
            </div>

            {/* 3. Total Accessory Cost */}
            <div style={{
              background: 'var(--bg-secondary, #ffffff)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IndianRupee size={24} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Lot Accessory Cost
                </div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#15803d', marginTop: '2px' }}>
                  {currencySymbol} {costingData.summary.totalAccessoryCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* 4. Cost Per Garment Piece (Highlighted) */}
            <div style={{
              background: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)', padding: '20px', borderRadius: '16px',
              color: '#ffffff', boxShadow: '0 4px 14px rgba(49, 46, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.15)', color: '#a5b4fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={24} />
              </div>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#c7d2fe', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Cost Per Garment Piece
                </div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff', marginTop: '2px' }}>
                  {currencySymbol} {costingData.summary.costPerGarmentPiece.toFixed(3)} <span style={{ fontSize: '13px', fontWeight: '600', color: '#a5b4fc' }}>/ pc</span>
                </div>
              </div>
            </div>

          </div>

          {/* ── Itemized Costing Table ── */}
          <div style={{
            background: 'var(--bg-secondary, #ffffff)', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflow: 'hidden'
          }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                  Store Issued Material Breakdown & Valuation
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  Formula: <strong>Quantity of Material × Rate / Price = Total Item Cost</strong>
                </p>
              </div>

              <div className="no-print" style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HelpCircle size={15} color="#94a3b8" />
                <span>Admin Tip: Click <strong>"Edit Rate"</strong> on any row to set or update material prices in real time.</span>
              </div>
            </div>

            {sortedItems.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                <AlertCircle size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                <p style={{ margin: 0, fontWeight: '600' }}>No issued materials found for Lot #{costingData.lot.lotNo}.</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Check if materials were issued under this lot in Material Issue or Without BOM Issue.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '12px 16px', width: '40px' }}>#</th>
                      <th style={{ padding: '12px 16px' }}>Item Code</th>
                      <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => toggleSort('materialName')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Material Item</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th style={{ padding: '12px 16px' }}>Category</th>
                      <th style={{ padding: '12px 16px' }}>Store Location</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('quantity')}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <span>Issued Quantity</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('rate')}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <span>Rate / Price</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('totalCost')}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <span>Total Cost (Qty × Rate)</span>
                          <ArrowUpDown size={12} />
                        </div>
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Cost / Pc</th>
                      <th className="no-print" style={{ padding: '12px 16px', textAlign: 'center' }}>Vouchers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((item, index) => {
                      const hasRate = item.rate > 0;
                      return (
                        <tr
                          key={item.key || index}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(248, 250, 252, 0.5)',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(241, 245, 249, 0.7)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'transparent' : 'rgba(248, 250, 252, 0.5)'}
                        >
                          {/* Row Number */}
                          <td style={{ padding: '14px 16px', fontWeight: '700', color: '#94a3b8' }}>
                            {index + 1}
                          </td>

                          {/* Item Code */}
                          <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              fontFamily: 'monospace', fontWeight: '800', fontSize: '12px',
                              padding: '3px 8px', borderRadius: '6px',
                              background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0'
                            }}>
                              {item.itemCode || 'ST-MISC'}
                            </span>
                          </td>

                          {/* Material Name & Photo */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.materialName}
                                  style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                                />
                              ) : (
                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800' }}>
                                  {item.materialName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: '700', color: '#1e293b' }}>
                                  {item.materialName}
                                </div>
                                {item.materialId && (
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    ID: {item.materialId}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '12px', fontSize: '11.5px', fontWeight: '600',
                              background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0'
                            }}>
                              {item.category || 'Accessory'}
                            </span>
                          </td>

                          {/* Store Location */}
                          <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12.5px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <MapPin size={13} color="#94a3b8" />
                              <span>{item.location || 'Store Floor'}</span>
                            </div>
                          </td>

                          {/* Issued Qty */}
                          <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>
                              {item.quantity.toLocaleString()}
                            </span>
                            <span style={{ marginLeft: '4px', fontSize: '12px', color: '#64748b' }}>
                              {item.unit}
                            </span>
                          </td>

                          {/* Unit Rate / Price */}
                          <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <span style={{
                                fontWeight: hasRate ? '800' : '600',
                                color: hasRate ? '#15803d' : '#e11d48',
                                fontSize: '13.5px'
                              }}>
                                {currencySymbol} {item.rate.toFixed(2)}
                              </span>
                              <button
                                type="button"
                                className="no-print"
                                onClick={() => handleOpenRateModal(item)}
                                style={{
                                  background: 'transparent', border: 'none', color: '#6366f1',
                                  cursor: 'pointer', padding: '3px', borderRadius: '4px'
                                }}
                                title="Edit or update rate for this material"
                              >
                                <Edit3 size={14} />
                              </button>
                            </div>
                          </td>

                          {/* Total Cost (Qty * Rate) */}
                          <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{
                              fontWeight: '900',
                              fontSize: '14.5px',
                              color: item.totalCost > 0 ? '#15803d' : '#94a3b8'
                            }}>
                              {currencySymbol} {item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* Cost Per Piece */}
                          <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap', color: '#475569', fontWeight: '700' }}>
                            {currencySymbol} {item.costPerPiece.toFixed(3)}
                          </td>

                          {/* Action - View Vouchers */}
                          <td className="no-print" style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setActiveSlipsItem(item)}
                              style={{
                                padding: '4px 10px', borderRadius: '8px',
                                border: '1px solid #cbd5e1', background: '#f8fafc',
                                color: '#334155', fontSize: '12px', fontWeight: '600',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}
                              title="View all issue vouchers for this material"
                            >
                              <Eye size={13} />
                              <span>{item.slips?.length || 1} slip(s)</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Summary Footer Row */}
                  <tfoot>
                    <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: '900', color: '#0f172a' }}>
                      <td colSpan={5} style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', textTransform: 'uppercase' }}>
                        Total Accessory Valuation ({sortedItems.length} Materials):
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px' }}>
                        {costingData.summary.totalIssuedUnits.toLocaleString()} units
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        —
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '16px', color: '#15803d' }}>
                        {currencySymbol} {costingData.summary.totalAccessoryCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '14px', color: '#4338ca' }}>
                        {currencySymbol} {costingData.summary.costPerGarmentPiece.toFixed(3)} / pc
                      </td>
                      <td className="no-print"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Printable Signature Section (Only shown during print) */}
          <div className="print-only" style={{ display: 'none', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #cbd5e1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px', textAlign: 'center' }}>
              <div>
                <div style={{ borderBottom: '1px solid #000', height: '40px' }}></div>
                <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: '700' }}>Prepared By (Store Executive)</p>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #000', height: '40px' }}></div>
                <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: '700' }}>Verified By (Store In-Charge)</p>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #000', height: '40px' }}></div>
                <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: '700' }}>Approved By (Admin / Production Lead)</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Rate Update Modal ── */}
      {editingItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', maxWidth: '440px', width: '100%',
            padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                  Update Material Rate
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ fontWeight: '800', color: '#1e293b' }}>{editingItem.materialName}</div>
              <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                Code: <strong>{editingItem.itemCode}</strong> • Unit: <strong>{editingItem.unit}</strong> • Issued: <strong>{editingItem.quantity} {editingItem.unit}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Enter Rate / Price per {editingItem.unit} ({currencySymbol})
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', color: '#64748b' }}>
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={newRateInput}
                  onChange={(e) => setNewRateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRate();
                  }}
                  placeholder="e.g. 2.50"
                  style={{
                    width: '100%', padding: '10px 14px 10px 32px', borderRadius: '10px',
                    border: '1.5px solid #cbd5e1', fontSize: '16px', fontWeight: '800', color: '#0f172a'
                  }}
                />
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Updating rate will automatically recompute total item cost and cost per garment piece.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                style={{
                  padding: '9px 16px', borderRadius: '10px', border: '1px solid #cbd5e1',
                  background: '#f8fafc', color: '#475569', fontWeight: '600', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingRate}
                onClick={handleSaveRate}
                style={{
                  padding: '9px 20px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff', fontWeight: '700', cursor: isSavingRate ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {isSavingRate ? <RefreshCw size={15} className="spin" /> : <Check size={15} />}
                <span>Save Rate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Issue Vouchers History Modal ── */}
      {activeSlipsItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', maxWidth: '640px', width: '100%',
            padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', maxHeight: '85vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                  Issue Vouchers History
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                  {activeSlipsItem.materialName} ({activeSlipsItem.itemCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSlipsItem(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px' }}>Slip / Voucher</th>
                    <th style={{ padding: '8px 10px' }}>Date</th>
                    <th style={{ padding: '8px 10px' }}>Issued By</th>
                    <th style={{ padding: '8px 10px' }}>Received By</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeSlipsItem.slips || []).map((slip, sIdx) => (
                    <tr key={sIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: '700', color: '#3b82f6' }}>
                        {slip.voucherId}
                        <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{slip.source}</div>
                      </td>
                      <td style={{ padding: '10px', color: '#475569' }}>
                        {slip.date}
                      </td>
                      <td style={{ padding: '10px', color: '#334155' }}>
                        {slip.issuer}
                      </td>
                      <td style={{ padding: '10px', color: '#334155' }}>
                        {slip.receiver}
                        {slip.receiverDept && <div style={{ fontSize: '10.5px', color: '#64748b' }}>{slip.receiverDept}</div>}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                        {slip.qty} {slip.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setActiveSlipsItem(null)}
                style={{
                  padding: '8px 16px', borderRadius: '10px', border: '1px solid #cbd5e1',
                  background: '#f8fafc', color: '#334155', fontWeight: '600', cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS For Printing */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .lot-costing-container {
            padding: 0 !important;
            max-width: 100% !important;
          }
          table {
            font-size: 11px !important;
          }
          th, td {
            padding: 6px 8px !important;
          }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
}
