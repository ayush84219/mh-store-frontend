import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeftRight, Search, Package, MapPin, CheckCircle, CheckCircle2,
  AlertTriangle, Clock, User, Calendar, RefreshCw, Printer, ArrowLeft,
  Plus, Minus, Check, Layers, ChevronDown, ChevronRight, X, Sparkles, Sliders,
  ArrowRight, Download, Box, ShieldCheck, Activity, Menu, Filter, ArrowUpRight,
  Edit3
} from 'lucide-react';
import SearchableLocationSelect from './SearchableLocationSelect';
import { getBackendUrl } from '../utils/api';

function SearchableMaterialSelect({ materials = [], value, onChange, placeholder = "— Select Material to Transfer —" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  const matList = Array.isArray(materials) ? materials : [];
  const selectedMaterial = matList.find(m => m && String(m.id) === String(value));

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

  const filtered = matList.filter(m => {
    if (!m) return false;
    const loc = String(m.location || m.color || '');
    const label = `${m.id || ''} ${m.name || ''} ${loc} ${m.category || ''}`.toLowerCase();
    return label.includes(searchQuery.toLowerCase().trim());
  });

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 99999 : 2 }}>
      {/* Trigger Box */}
      <div 
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) setSearchQuery('');
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 14px',
          minHeight: '44px',
          borderRadius: '8px',
          border: isOpen ? '1.5px solid var(--accent-color, #0284c7)' : '1.5px solid var(--border-color, #cbd5e1)',
          background: 'var(--bg-secondary, #ffffff)',
          color: selectedMaterial ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #94a3b8)',
          fontSize: '13px',
          fontWeight: '700',
          transition: 'all 0.2s ease',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(2, 132, 199, 0.15)' : 'none'
        }}
      >
        {selectedMaterial ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, paddingRight: '8px' }}>
            <span style={{
              background: 'rgba(2, 132, 199, 0.12)',
              color: 'var(--accent-color, #0284c7)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '800',
              fontFamily: 'monospace',
              letterSpacing: '0.5px',
              flexShrink: 0
            }}>
              {selectedMaterial.id}
            </span>
            <span style={{ fontWeight: '700', color: 'var(--text-main, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedMaterial.name}
            </span>
            {selectedMaterial.category && (
              <span style={{
                fontSize: '10.5px',
                fontWeight: '700',
                color: 'var(--text-muted, #64748b)',
                backgroundColor: 'var(--bg-primary, #f0f7ff)',
                padding: '2px 7px',
                borderRadius: '4px',
                border: '1px solid var(--border-color, #dbeafe)',
                flexShrink: 0
              }}>
                {selectedMaterial.category}
              </span>
            )}
            <span style={{
              fontSize: '11.5px',
              fontWeight: '700',
              color: '#059669',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '2px 8px',
              borderRadius: '4px',
              flexShrink: 0,
              marginLeft: 'auto'
            }}>
              {selectedMaterial.stock} {selectedMaterial.unit || 'Pcs'}
            </span>
            <button
              type="button"
              title="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setIsOpen(false);
                setSearchQuery('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '3px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-muted, #94a3b8)',
                borderRadius: '4px',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted, #94a3b8)' }}>
            <Package size={16} style={{ color: 'var(--accent-color, #0284c7)' }} />
            <span style={{ fontWeight: '600' }}>{placeholder}</span>
          </div>
        )}
        <ChevronDown size={16} style={{ color: 'var(--text-muted, #64748b)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }} />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: 'var(--bg-secondary, #ffffff)',
          border: '1.5px solid var(--border-color, #cbd5e1)',
          borderRadius: '10px',
          boxShadow: '0 14px 34px -4px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.06)',
          zIndex: 100000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Seamless Pinned Search Bar Header (No box-in-a-box) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            background: 'var(--bg-secondary, #ffffff)',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            flexShrink: 0
          }}>
            <Search size={15} style={{ color: 'var(--accent-color, #0284c7)', flexShrink: 0 }} />
            <input 
              type="text" 
              placeholder="Search by code, material name, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="seamless-search-input"
              style={{
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                background: 'transparent',
                backgroundColor: 'transparent',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none',
                width: '100%',
                flex: 1,
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-main, #0f172a)',
                padding: '0',
                margin: '0',
                height: 'auto',
                lineHeight: '1.4'
              }}
            />
            {searchQuery && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted, #94a3b8)', background: 'var(--bg-primary, #f0f7ff)', padding: '1px 6px', borderRadius: '4px' }}>
                  {filtered.length} found
                </span>
                <button
                  type="button"
                  title="Clear search"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted, #94a3b8)',
                    borderRadius: '50%',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'}
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Results Area */}
          <div style={{
            maxHeight: '260px',
            overflowY: 'auto',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main, #0f172a)', marginBottom: '4px' }}>
                  No matching materials
                </div>
                <div style={{ fontSize: '11.5px', fontWeight: '500' }}>
                  {searchQuery ? `No results found for "${searchQuery}"` : 'No materials available in catalog'}
                </div>
              </div>
            ) : (
              filtered.map(m => {
                const isSelected = String(value) === String(m.id);
                const loc = m.location || (m.color && (m.color.toLowerCase().includes('hall') || m.color.toLowerCase().includes('rack') || m.color.toLowerCase().includes('store')) ? m.color : 'Main Store');
                return (
                  <div 
                    key={m.id}
                    onClick={() => {
                      onChange(m.id);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      background: isSelected ? 'rgba(2, 132, 199, 0.1)' : 'transparent',
                      border: isSelected ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid transparent'
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-primary, #f0f7ff)'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', fontFamily: 'monospace', color: 'var(--accent-color, #0284c7)', background: 'rgba(2, 132, 199, 0.12)', padding: '1px 6px', borderRadius: '4px' }}>
                          {m.id}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>
                          {m.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#059669' }}>
                        {m.stock} {m.unit || 'Pcs'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                      <MapPin size={11} style={{ color: 'var(--accent-color, #0284c7)' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {loc}
                      </span>
                      <span style={{ marginLeft: 'auto', fontWeight: '700', color: 'var(--accent-color, #0284c7)' }}>
                        {m.packets || 1} pkts
                      </span>
                    </div>
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

// Barcode Renderer Component
const BarcodeVisual = ({ code }) => {
  const str = String(code || 'MT1000-A01');
  let currentX = 4;
  const bars = [];

  const startPattern = [2, 1, 1, 2, 1, 4];
  let isBar = true;
  startPattern.forEach((w, idx) => {
    if (isBar) {
      bars.push(<rect key={`st-${idx}`} x={currentX} y={0} width={w * 1.5} height={45} fill="#000000" />);
    }
    currentX += w * 1.5;
    isBar = !isBar;
  });

  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const b1 = (charCode % 3) + 1;
    const s1 = ((charCode >> 1) % 2) + 1;
    const b2 = ((charCode >> 2) % 3) + 1;
    const s2 = ((charCode >> 3) % 2) + 1;
    const b3 = ((charCode >> 4) % 2) + 1;
    const s3 = 11 - (b1 + s1 + b2 + s2 + b3);

    const widths = [b1, Math.max(1, s1), b2, Math.max(1, s2), b3, Math.max(1, s3)];
    let barFlag = true;
    widths.forEach((w, wIdx) => {
      if (barFlag) {
        bars.push(<rect key={`c-${i}-${wIdx}`} x={currentX} y={0} width={w * 1.3} height={45} fill="#000000" />);
      }
      currentX += w * 1.3;
      barFlag = !barFlag;
    });
  }

  [2, 3, 3, 1, 1, 1, 2].forEach((w, idx) => {
    bars.push(<rect key={`sp-${idx}`} x={currentX} y={0} width={w * 1.3} height={45} fill="#000000" />);
    currentX += w * 1.3;
  });

  const totalWidth = Math.max(150, Math.ceil(currentX + 8));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      backgroundColor: '#ffffff',
      padding: '6px 10px',
      border: '1.5px solid #333333',
      borderRadius: '4px',
      width: '100%',
      maxWidth: '220px',
      color: '#000000',
      textAlign: 'center',
      margin: '0 auto'
    }}>
      <svg width="100%" height="40" viewBox={`0 0 ${totalWidth} 45`} preserveAspectRatio="xMidYMid meet">
        <g>{bars}</g>
      </svg>
      <span style={{ 
        fontSize: '11px', 
        fontFamily: 'monospace', 
        fontWeight: 'bold', 
        marginTop: '2px', 
        letterSpacing: '1px',
        color: '#000000'
      }}>
        {str}
      </span>
    </div>
  );
};

export default function MaterialTransferView({
  currentUser,
  racks: propRacks = [],
  halls: propHalls = [],
  materials: propMaterials = []
}) {
  const [materials, setMaterials] = useState(() => (Array.isArray(propMaterials) && propMaterials.length > 0 ? propMaterials : []));
  const [warehouseLocations, setWarehouseLocations] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [sourceLocations, setSourceLocations] = useState([]);
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [operatorName, setOperatorName] = useState(() => currentUser?.name || 'Admin');
  useEffect(() => {
    if (currentUser?.name && (!operatorName || operatorName === 'Admin')) {
      setOperatorName(currentUser.name);
    }
  }, [currentUser]);
  const [history, setHistory] = useState([]);
  const [logSearch, setLogSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [printModalData, setPrintModalData] = useState(null);
  const [lastTransferSuccess, setLastTransferSuccess] = useState(null);

  // Live timer matching ManuallyWeightCapture
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Pagination & Sorting for Activity Log Table
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(10);
  const [orderBy, setOrderBy] = useState('transferredAt');
  const [order, setOrder] = useState('desc');

  // Printer connection state
  const [printerStatus, setPrinterStatus] = useState('offline');
  const [printerName, setPrinterName] = useState('');
  const printerWsRef = useRef(null);

  const connectPrinter = () => {
    if (printerWsRef.current && printerWsRef.current.readyState === WebSocket.OPEN) {
      printerWsRef.current.close();
    }
    setPrinterStatus('connecting');
    setPrinterName('');
    try {
      const ws = new WebSocket('ws://localhost:8765');
      printerWsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token: 'fabric-print-secret-key-2024' }));
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'auth_success') {
          ws.send(JSON.stringify({ type: 'status' }));
        } else if (msg.type === 'status') {
          setPrinterStatus('online');
          setPrinterName(msg.printerName || 'USB Printer');
          ws.close();
        } else if (msg.type === 'auth_failed') {
          setPrinterStatus('offline');
          ws.close();
        }
      };
      ws.onerror = () => setPrinterStatus('offline');
      ws.onclose = () => { if (printerStatus === 'connecting') setPrinterStatus('offline'); };
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          setPrinterStatus('online');
          setPrinterName('USB Printer');
          ws.close();
        }
      }, 3000);
    } catch (e) {
      setPrinterStatus('offline');
    }
  };

  useEffect(() => {
    connectPrinter();
    const interval = setInterval(connectPrinter, 10000);
    return () => clearInterval(interval);
  }, []);

  const selectedMaterial = (materials || []).find(m => m && String(m.id) === String(selectedMaterialId));

  // Fetch materials, transfer logs & warehouse locations
  const fetchData = async () => {
    setLoading(true);
    try {
      const [matRes, transRes, whRes] = await Promise.all([
        fetch(`${getBackendUrl()}/api/materials`).catch(() => null),
        fetch(`${getBackendUrl()}/api/transfers`).catch(() => null),
        fetch(`${getBackendUrl()}/api/warehouse-locations`).catch(() => null)
      ]);
      if (matRes && matRes.ok) {
        const matData = await matRes.json();
        setMaterials(matData);
      }
      if (transRes && transRes.ok) {
        const transData = await transRes.json();
        setHistory(transData);
      }
      if (whRes && whRes.ok) {
        const whData = await whRes.json();
        const list = Array.isArray(whData) ? whData : (whData.data || []);
        setWarehouseLocations(list);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleResetForm = () => {
    setSelectedMaterialId('');
    setSourceLocations([]);
    setFromLoc('');
    setToLoc('');
    setTransferQty(1);
    setOperatorName(currentUser?.name || 'Admin');
    setLastTransferSuccess(null);
  };

  // Robust case-insensitive location parser
  const parseLocationString = (locStr, packetsTotal = 1) => {
    if (!locStr) return [{ location: 'Main Store', count: packetsTotal }];
    
    if (!/pkt/i.test(locStr) && !locStr.includes('(')) {
      return [{ location: locStr.trim(), count: packetsTotal }];
    }

    const parts = locStr.split(',');
    const list = [];
    parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;
      const match = trimmed.match(/^(.+?)\s*\(\s*(\d+)\s*(?:pkts?|packets?)?\s*\)$/i) || trimmed.match(/(.+?)\s*\((\d+)/i);
      if (match) {
        list.push({
          location: match[1].trim(),
          count: parseInt(match[2], 10) || 1
        });
      } else {
        list.push({
          location: trimmed,
          count: 1
        });
      }
    });
    return list.length > 0 ? list : [{ location: 'Main Store', count: packetsTotal }];
  };

  const serializeLocations = (groups) => {
    const active = groups.filter(g => g.location.trim() && g.count > 0);
    if (active.length === 0) return 'Main Store';
    if (active.length === 1 && active[0].count === 1) return active[0].location.trim();
    return active
      .map(g => `${g.location.trim()} (${g.count} pkt${g.count > 1 ? 's' : ''})`)
      .join(', ');
  };

  // Parse source locations when material selection changes
  useEffect(() => {
    if (!selectedMaterial) {
      setSourceLocations([]);
      setFromLoc('');
      setTransferQty(1);
      return;
    }

    const locStr = selectedMaterial.location || (selectedMaterial.color && (selectedMaterial.color.toLowerCase().includes('hall') || selectedMaterial.color.toLowerCase().includes('rack') || selectedMaterial.color.toLowerCase().includes('store')) ? selectedMaterial.color : 'Main Store');
    const pkts = Math.max(1, selectedMaterial.packets || 1);
    
    const parsed = parseLocationString(locStr, pkts);
    setSourceLocations(parsed);
    if (parsed.length > 0) {
      setFromLoc(parsed[0].location);
      setTransferQty(1);
    }
  }, [selectedMaterialId, materials]);

  const showNotification = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleExecuteTransfer = async () => {
    if (!selectedMaterialId) {
      showNotification('Please select an accessory material first.', 'error');
      return;
    }
    if (!fromLoc) {
      showNotification('Please select a source rack location.', 'error');
      return;
    }
    if (!toLoc.trim()) {
      showNotification('Please specify a destination rack or slot.', 'error');
      return;
    }
    if (fromLoc.trim().toLowerCase() === toLoc.trim().toLowerCase()) {
      showNotification('Source and destination rack cannot be the same.', 'error');
      return;
    }

    const sourceGroup = sourceLocations.find(g => g.location === fromLoc);
    if (!sourceGroup) {
      showNotification('Invalid source location selected.', 'error');
      return;
    }

    const qty = parseInt(transferQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showNotification('Please enter a valid transfer quantity (at least 1 packet).', 'error');
      return;
    }

    if (qty > sourceGroup.count) {
      showNotification(`Insufficient packet count at ${fromLoc}. Max available: ${sourceGroup.count}`, 'error');
      return;
    }

    if (!operatorName || !operatorName.trim()) {
      showNotification('Please enter the Operator / Transferred By name.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Calculate updated locations list
      let updatedGroups = sourceLocations.map(g => {
        if (g.location === fromLoc) {
          return { ...g, count: g.count - qty };
        }
        return g;
      });

      // Add to destination location group
      const destIndex = updatedGroups.findIndex(g => g.location.toLowerCase() === toLoc.trim().toLowerCase());
      if (destIndex !== -1) {
        updatedGroups[destIndex].count += qty;
      } else {
        updatedGroups.push({ location: toLoc.trim(), count: qty });
      }

      updatedGroups = updatedGroups.filter(g => g.count > 0);
      const newLocSummary = serializeLocations(updatedGroups);

      // 2. PUT request to update material's location
      const updatedMaterial = {
        ...selectedMaterial,
        location: newLocSummary
      };

      const putRes = await fetch(`${getBackendUrl()}/api/materials/${selectedMaterialId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMaterial)
      });

      if (!putRes.ok) throw new Error('Failed to update material location in database');

      // 3. Post transfer log to API
      const logPayload = {
        materialCode: selectedMaterialId,
        materialName: selectedMaterial.name,
        fromLocation: fromLoc,
        toLocation: toLoc.trim(),
        quantity: qty,
        transferType: 'packet',
        operator: operatorName.trim() || currentUser?.name || 'Admin'
      };

      const logRes = await fetch(`${getBackendUrl()}/api/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logPayload)
      });

      if (!logRes.ok) throw new Error('Failed to log transfer history');

      // Completed transfer metadata
      const completedTransfer = {
        id: Date.now(),
        materialCode: selectedMaterialId,
        materialName: selectedMaterial.name,
        fromLocation: fromLoc,
        toLocation: toLoc.trim(),
        quantity: qty,
        operator: operatorName.trim() || currentUser?.name || 'Admin',
        transferredAt: new Date().toISOString()
      };
      setLastTransferSuccess(completedTransfer);

      if (window._transferSuccessTimer) clearTimeout(window._transferSuccessTimer);
      window._transferSuccessTimer = setTimeout(() => {
        setLastTransferSuccess(null);
      }, 5000);

      showNotification(`Successfully transferred ${qty} packet(s) of ${selectedMaterial.name} to ${toLoc}!`);
      
      // Cleanly reset form
      setSelectedMaterialId('');
      setSourceLocations([]);
      setFromLoc('');
      setToLoc('');
      setTransferQty(1);

      await fetchData();
    } catch (err) {
      console.error(err);
      showNotification('Transfer execution failed: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintTransferLabel = async (item) => {
    const material = (materials || []).find(m => String(m.id) === String(item.materialCode));
    const totalToPrint = Math.max(1, Number(item.quantity) || 1);

    let matchingCaptures = [];
    try {
      const res = await fetch(`${getBackendUrl()}/api/weight-capture?summary=true`);
      if (res.ok) {
        const result = await res.json();
        const captures = result.data || (Array.isArray(result) ? result : []);
        matchingCaptures = captures.filter(c => String(c.materialCode) === String(item.materialCode));
      }
    } catch (err) {
      console.warn("Failed to fetch weight captures for transfer label:", err);
    }

    const d = new Date();
    const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const printDate =
      String(d.getDate()).padStart(2, '0') + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      d.getFullYear() + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0');

    const totalPkts = material ? Math.max(1, material.packets || totalToPrint) : totalToPrint;
    const pktQty = material ? Math.round((Number(material.stock || 0) / totalPkts) * 100) / 100 : totalToPrint;

    const stickers = [];
    for (let pkt = 1; pkt <= totalToPrint; pkt++) {
      const pktBarcodeId = `${item.materialCode}-A${String(pkt).padStart(2, '0')}`;
      const capture = matchingCaptures.find(c => c.barcodeId === pktBarcodeId)
        || matchingCaptures[pkt - 1]
        || matchingCaptures[0];

      const displayWeight = capture ? `${capture.netWeightKg} KG` : `${pktQty} ${material?.unit || 'Pcs'}`;
      const displayPieces = capture ? String(capture.pieces) : String(pktQty);
      const displayTotalQty = capture ? `${capture.pieces} ${material?.unit || 'Pcs'}` : `${material?.stock || pktQty} ${material?.unit || 'Pcs'}`;
      const displayPo = capture?.poNumber || material?.poNumber || material?.po || 'N/A';
      const displayBill = capture?.invoiceNo || material?.invoiceNo || material?.billNo || 'N/A';
      const displayCmp = capture?.supplier || material?.supplier || 'paras';

      stickers.push({
        barcodeId: pktBarcodeId,
        materialCode: item.materialCode,
        materialName: item.materialName || material?.name || 'Accessory Material',
        category: material?.category || 'Accessory',
        shade: material?.color || 'Default',
        weight: displayWeight,
        pieces: displayPieces,
        totalQty: displayTotalQty,
        unit: material?.unit || 'Pcs',
        location: item.toLocation,
        date: dateStr,
        printDate,
        poNumber: displayPo,
        billNo: displayBill,
        cmp: displayCmp,
        lotNo: material?.id || item.materialCode,
        operator: item.operator || 'Admin',
        packetNo: pkt,
        totalPackets: totalPkts
      });
    }

    setPrintModalData({
      item,
      stickers,
      material
    });

    try {
      const pws = new WebSocket('ws://localhost:8765');
      let nextPkt = 0;
      pws.onopen = () => {
        pws.send(JSON.stringify({ type: 'auth', token: 'fabric-print-secret-key-2024' }));
      };
      pws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'auth_success' || (msg.type === 'print_accessory_result' && msg.success)) {
          if (nextPkt < stickers.length) {
            pws.send(JSON.stringify({
              type: 'print_accessory',
              data: stickers[nextPkt]
            }));
            nextPkt++;
          } else {
            pws.close();
            showNotification(`✅ All ${stickers.length} transfer sticker(s) printed to thermal machine!`);
          }
        }
      };
    } catch (_) {}
  };

  const destinationOptions = useMemo(() => {
    const locMap = new Map();

    const addLocation = (rawCode, warehouseHint = '') => {
      if (!rawCode) return;
      const str = String(rawCode).trim();
      if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return;

      let warehouse = warehouseHint ? warehouseHint.trim() : '';
      let cleanCode = str;

      if (str.includes(' - ')) {
        const parts = str.split(' - ');
        warehouse = parts[0].trim();
        cleanCode = `${warehouse} - ${parts.slice(1).join(' - ').trim()}`;
      } else if (/^hall\s*\d+/i.test(str)) {
        const m = str.match(/^hall\s*\d+/i);
        warehouse = m[0].replace(/\s+/g, ' ');
        const remainder = str.replace(new RegExp(`^${warehouse}\\s*[-–]?\\s*`, 'i'), '').trim();
        cleanCode = remainder ? `${warehouse} - ${remainder}` : `${warehouse} - Rack 1`;
      } else if (/^main\s*store/i.test(str)) {
        warehouse = 'Main Store';
        const remainder = str.replace(/^main\s*store\s*[-–]?\s*/i, '').trim();
        cleanCode = remainder ? `Main Store - ${remainder}` : `Main Store - Rack 1`;
      } else if (/^store/i.test(str)) {
        warehouse = 'Store';
        const remainder = str.replace(/^store\s*[-–]?\s*/i, '').trim();
        cleanCode = remainder ? `Store - ${remainder}` : `Store - Rack 1`;
      }

      if (!warehouse) {
        warehouse = 'Main Store';
      }

      // Format rack title consistently (e.g. "rack 1" -> "Rack 1")
      cleanCode = cleanCode.replace(/\brack\s*(\d+)/i, (_, n) => `Rack ${n}`);

      const key = cleanCode.toLowerCase().replace(/\s+/g, ' ');
      if (!locMap.has(key)) {
        locMap.set(key, {
          code: cleanCode,
          label: cleanCode,
          warehouse: warehouse
        });
      }
    };

    // 1. Add all official custom locations from warehouse_locations DB
    (warehouseLocations || []).forEach(w => {
      addLocation(w.code || w.label || w.id, w.warehouse);
    });

    // 2. Add all locations from prop racks & localStorage racks
    const allRacks = (propRacks && propRacks.length > 0) ? propRacks : (() => {
      try {
        const s = localStorage.getItem('warehouse_racks');
        return s ? JSON.parse(s) : [];
      } catch { return []; }
    })();
    (allRacks || []).forEach(r => {
      const code = r.code && String(r.code).includes('-') ? r.code : `${r.warehouse || 'Main Store'} - ${r.name || `Rack ${r.code}`}`;
      addLocation(code, r.warehouse);
    });

    // 3. Add all locations actively referenced by materials in the warehouse catalog
    const allMaterials = (materials && materials.length > 0) ? materials : propMaterials;
    (allMaterials || []).forEach(m => {
      const locStr = String(m.location || '').trim();
      if (!locStr) return;
      const parts = locStr.split(',');
      parts.forEach(p => {
        const clean = p.replace(/\(\d+.*?\)/i, '').trim();
        if (clean && clean.toLowerCase() !== 'n/a' && clean.toLowerCase() !== 'null') {
          addLocation(clean);
        }
      });
    });

    // Fallback only if no real locations were discovered anywhere
    if (locMap.size === 0) {
      addLocation('Main Store - Rack 1', 'Main Store');
    }

    // Sort locations logically: by warehouse, then by numeric rack number
    const list = Array.from(locMap.values());
    list.sort((a, b) => {
      if (a.warehouse !== b.warehouse) {
        return a.warehouse.localeCompare(b.warehouse);
      }
      const numA = parseInt((a.label.match(/\d+/) || [0])[0], 10);
      const numB = parseInt((b.label.match(/\d+/) || [0])[0], 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return a.label.localeCompare(b.label, undefined, { numeric: true });
    });

    return list;
  }, [warehouseLocations, propRacks, materials, propMaterials]);

  const todayStr = useMemo(() => new Date().toDateString(), []);

  const transfersTodayList = useMemo(() => {
    return (history || []).filter(item => {
      if (!item.transferredAt) return false;
      const d = new Date(item.transferredAt);
      return !isNaN(d.getTime()) && d.toDateString() === todayStr;
    });
  }, [history, todayStr]);

  const packetsMovedToday = useMemo(() => {
    return transfersTodayList.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  }, [transfersTodayList]);

  const distinctRacksCount = useMemo(() => {
    const locSet = new Set();
    (materials || []).forEach(m => {
      const locStr = String(m.location || '');
      if (locStr) {
        locStr.split(',').forEach(p => {
          const clean = p.replace(/\(\d+.*?\)/, '').trim();
          if (clean && clean.toLowerCase() !== 'main store') locSet.add(clean.toLowerCase());
        });
      }
    });
    return locSet.size > 0 ? locSet.size : (warehouseLocations?.length || 12);
  }, [materials, warehouseLocations]);

  const handleExportCSV = () => {
    if (!history || history.length === 0) {
      showNotification('No transfer records available to export.', 'error');
      return;
    }
    const headers = ['Date', 'Time', 'Material Code', 'Material Name', 'From Location', 'To Location', 'Packets', 'Operator'];
    const rows = history.map(item => {
      const d = item.transferredAt ? new Date(item.transferredAt) : null;
      const dateStr = d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-IN') : 'N/A';
      const timeStr = d && !isNaN(d.getTime()) ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A';
      return [
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${item.materialCode || ''}"`,
        `"${(item.materialName || '').replace(/"/g, '""')}"`,
        `"${item.fromLocation || ''}"`,
        `"${item.toLocation || ''}"`,
        `"${item.quantity || 1}"`,
        `"${item.operator || 'Admin'}"`
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `material_transfers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Exported transfer activity log successfully!');
  };

  // Filtered and Sorted History Data
  const filteredHistory = useMemo(() => {
    let list = (history || []).filter(item => {
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase().trim();
        const matchStr = `${item.materialCode || ''} ${item.materialName || ''} ${item.fromLocation || ''} ${item.toLocation || ''} ${item.operator || ''}`.toLowerCase();
        if (!matchStr.includes(q)) return false;
      }

      if (timeFilter !== 'all' && item.transferredAt) {
        const itemDate = new Date(item.transferredAt);
        const curDate = new Date();
        if (timeFilter === 'today') {
          if (itemDate.toDateString() !== curDate.toDateString()) return false;
        } else if (timeFilter === 'yesterday') {
          const yesterday = new Date(curDate);
          yesterday.setDate(curDate.getDate() - 1);
          if (itemDate.toDateString() !== yesterday.toDateString()) return false;
        } else if (timeFilter === 'week') {
          const sevenDaysAgo = new Date(curDate);
          sevenDaysAgo.setDate(curDate.getDate() - 7);
          if (itemDate < sevenDaysAgo) return false;
        }
      }
      return true;
    });

    list.sort((a, b) => {
      let av = a[orderBy] ?? '';
      let bv = b[orderBy] ?? '';
      if (orderBy === 'transferredAt') {
        av = new Date(av || 0).getTime();
        bv = new Date(bv || 0).getTime();
      } else if (typeof av === 'string') {
        av = av.toLowerCase();
        bv = bv.toLowerCase();
      }
      if (av < bv) return order === 'asc' ? -1 : 1;
      if (av > bv) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [history, logSearch, timeFilter, orderBy, order]);

  const paginatedHistory = useMemo(() => {
    const start = page * rpp;
    return filteredHistory.slice(start, start + rpp);
  }, [filteredHistory, page, rpp]);

  const totalPages = Math.ceil(filteredHistory.length / rpp) || 1;

  const handleSort = (col) => {
    if (orderBy === col) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(col);
      setOrder('desc');
    }
  };

  // Helper calculations for quantity card
  const maxAvailable = sourceLocations.find(g => g.location === fromLoc)?.count || 1;
  const totalPkts = selectedMaterial?.packets || maxAvailable;
  const approxPcsPerPkt = selectedMaterial ? Math.round(Number(selectedMaterial.stock || 0) / Math.max(1, totalPkts)) : 0;
  const movingPcs = (Number(transferQty) || 0) * approxPcsPerPkt;
  const remainingAfter = maxAvailable - (Number(transferQty) || 0);

  return (
    <div className="page-container" style={{ padding: '16px', maxWidth: '100%', boxSizing: 'border-box' }}>
      
      {/* Scoped CSS Styles to guarantee identical styling with the application */}
      <style>{`
        .wcs-input {
          padding: 10px 14px;
          border: 1.5px solid var(--border-color, #cbd5e1);
          border-radius: 8px;
          background: var(--bg-secondary, #ffffff);
          color: var(--text-main, #0f172a);
          font-size: 13.5px;
          font-weight: 700;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        .wcs-input:focus {
          border-color: var(--accent-color, #3b82f6);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
        .wcs-label {
          font-size: 11.5px;
          font-weight: 800;
          color: var(--text-main, #1e293b);
          text-transform: uppercase;
          display: block;
          margin-bottom: 6px;
          letter-spacing: 0.5px;
        }
      `}</style>

      {/* Toast Popup Notification */}
      {toast && (
        <div className="notification-toast animate-scale" style={{ position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 1200 }}>
          {toast.type === 'error' ? <AlertTriangle style={{ color: '#ef4444' }} /> : <CheckCircle2 style={{ color: '#10b981' }} />}
          <div className="notification-content">
            <div className="notification-title" style={{ color: toast.type === 'error' ? '#ef4444' : '#10b981' }}>
              {toast.type === 'error' ? 'ALERT' : 'SUCCESS'}
            </div>
            <div className="notification-body">{toast.message}</div>
          </div>
        </div>
      )}

      {/* ── 1. UNIFIED APPLICATION HEADER ────────────────────────────────────────── */}
      <div className="panel" style={{ padding: '16px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderRadius: '12px', border: '1.5px solid var(--border-color, #e2e8f0)', background: 'var(--bg-secondary, #ffffff)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', background: 'var(--accent-color, #0284c7)', color: '#ffffff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}>
            <ArrowLeftRight size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-main, #0f172a)' }}>Material Store Transfer</h2>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)' }}>Warehouse Internal Stock Relocation & Rack Tracking</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Live Date & Time Clock */}
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'block' }}>
              {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span style={{ fontSize: '15px', fontWeight: '700', fontFamily: 'monospace', color: 'var(--text-main, #0f172a)' }}>
              {now.toTimeString().slice(0, 8)}
            </span>
          </div>

          <div style={{ borderLeft: '1px solid var(--border-color, #cbd5e1)', height: '24px' }}></div>

          {/* Operator Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--accent-color, #0284c7)', color: '#ffffff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px' }}>
              {(currentUser?.name || 'A')[0].toUpperCase()}
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)', display: 'block' }}>Operator</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>{currentUser?.name || 'Admin'}</span>
            </div>
          </div>

          {/* Mode Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px',
            backgroundColor: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent-color, #0284c7)',
            border: '1.5px solid rgba(2, 132, 199, 0.25)', fontWeight: '700', fontSize: '12px'
          }}>
            <ArrowLeftRight size={14} />
            <span>Stock Relocate</span>
          </div>

          {/* Printer Status Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '6px', fontWeight: '700', fontSize: '12px',
            backgroundColor: printerStatus === 'online'
              ? 'rgba(16, 185, 129, 0.1)'
              : printerStatus === 'connecting'
                ? 'rgba(251, 191, 36, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
            color: printerStatus === 'online' ? '#10b981'
              : printerStatus === 'connecting' ? '#f59e0b'
                : '#ef4444',
            border: `1.5px solid ${printerStatus === 'online' ? 'rgba(16, 185, 129, 0.25)'
              : printerStatus === 'connecting' ? 'rgba(251, 191, 36, 0.25)'
                : 'rgba(239, 68, 68, 0.25)'}`,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
            onClick={connectPrinter}
            title={printerStatus === 'online' ? `Default Printer: ${printerName || 'USB Printer'} (Click to reconnect)` : 'Click to connect print service'}
          >
            <Printer size={14} />
            <span>{printerStatus === 'connecting' ? 'Connecting...' : (printerStatus === 'online' ? (printerName || 'USB Printer Ready') : 'Printer Offline')}</span>
          </div>

          <button
            type="button"
            onClick={fetchData}
            title="Refresh Data"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px', borderRadius: '6px',
              border: '1.5px solid var(--border-color, #cbd5e1)', background: 'var(--bg-secondary, #ffffff)',
              color: 'var(--text-main, #0f172a)', cursor: 'pointer', transition: 'all 0.2s ease', padding: 0
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── 2. STEP-BY-STEP OPERATING INSTRUCTIONS WORKFLOW BANNER ──────────────────── */}
      <div className="panel" style={{
        padding: '18px 24px', borderRadius: '12px', border: '1.5px solid var(--border-color, #e2e8f0)',
        marginBottom: '20px', background: 'var(--bg-secondary, #ffffff)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
      }}>
        <h3 style={{ fontSize: '14.5px', fontWeight: '900', color: 'var(--text-main, #0f172a)', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📋 Operating Instructions: Step-by-Step Material Transfer Workflow
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {/* Step 1 */}
          <div style={{
            padding: '12px 14px', borderRadius: '8px', border: `1.5px solid ${selectedMaterialId ? '#10b981' : 'var(--border-color, #cbd5e1)'}`,
            background: selectedMaterialId ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary, #f0f7ff)', transition: 'all 0.3s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: selectedMaterialId ? '#10b981' : 'var(--accent-color, #0284c7)', color: '#ffffff',
                fontSize: '11px', fontWeight: '800', alignItems: 'center', justifyContent: 'center', marginRight: '8px'
              }}>
                {selectedMaterialId ? <Check size={12} strokeWidth={3} /> : '1'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Select Accessory Material</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)', margin: 0, lineHeight: '1.4' }}>
              {selectedMaterial ? `${selectedMaterial.name} (${selectedMaterial.stock} ${selectedMaterial.unit || 'Pcs'})` : 'Select accessory material from warehouse catalog.'}
            </p>
          </div>

          {/* Step 2 */}
          <div style={{
            padding: '12px 14px', borderRadius: '8px', border: `1.5px solid ${fromLoc ? '#10b981' : 'var(--border-color, #cbd5e1)'}`,
            background: fromLoc ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary, #f0f7ff)', transition: 'all 0.3s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: fromLoc ? '#10b981' : 'var(--accent-color, #0284c7)', color: '#ffffff',
                fontSize: '11px', fontWeight: '800', alignItems: 'center', justifyContent: 'center', marginRight: '8px'
              }}>
                {fromLoc ? <Check size={12} strokeWidth={3} /> : '2'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Identify Source Rack</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)', margin: 0, lineHeight: '1.4' }}>
              {fromLoc ? `Source slot set: ${fromLoc}` : 'Verify source rack containing stock packets.'}
            </p>
          </div>

          {/* Step 3 */}
          <div style={{
            padding: '12px 14px', borderRadius: '8px', border: `1.5px solid ${(toLoc && toLoc.toLowerCase() !== fromLoc.toLowerCase()) ? '#10b981' : 'var(--border-color, #cbd5e1)'}`,
            background: (toLoc && toLoc.toLowerCase() !== fromLoc.toLowerCase()) ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary, #f0f7ff)', transition: 'all 0.3s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: (toLoc && toLoc.toLowerCase() !== fromLoc.toLowerCase()) ? '#10b981' : 'var(--accent-color, #0284c7)', color: '#ffffff',
                fontSize: '11px', fontWeight: '800', alignItems: 'center', justifyContent: 'center', marginRight: '8px'
              }}>
                {(toLoc && toLoc.toLowerCase() !== fromLoc.toLowerCase()) ? <Check size={12} strokeWidth={3} /> : '3'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Assign Destination Rack</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)', margin: 0, lineHeight: '1.4' }}>
              {toLoc ? `Target rack: ${toLoc}` : 'Select destination rack from master location slots.'}
            </p>
          </div>

          {/* Step 4 */}
          <div style={{
            padding: '12px 14px', borderRadius: '8px', border: `1.5px solid ${(transferQty > 0 && selectedMaterialId && toLoc && toLoc.toLowerCase() !== fromLoc.toLowerCase()) ? '#10b981' : 'var(--border-color, #cbd5e1)'}`,
            background: (transferQty > 0 && selectedMaterialId && toLoc && toLoc.toLowerCase() !== fromLoc.toLowerCase()) ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary, #f0f7ff)', transition: 'all 0.3s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: (transferQty > 0 && selectedMaterialId && toLoc && toLoc.toLowerCase() !== fromLoc.toLowerCase()) ? '#10b981' : 'var(--accent-color, #0284c7)', color: '#ffffff',
                fontSize: '11px', fontWeight: '800', alignItems: 'center', justifyContent: 'center', marginRight: '8px'
              }}>
                {(transferQty > 0 && selectedMaterialId && toLoc && toLoc.toLowerCase() !== fromLoc.toLowerCase()) ? <Check size={12} strokeWidth={3} /> : '4'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Quantity & Execute</span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)', margin: 0, lineHeight: '1.4' }}>
              {transferQty > 0 ? `Move ${transferQty} packet(s) (~${movingPcs} Pcs)` : 'Set quantity and confirm transfer.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. MATERIAL TRANSFER WORKSTATION PANEL ─────────────────────────────────── */}
      <div className="panel" style={{
        padding: '24px', borderRadius: '12px', border: '1.5px solid var(--border-color, #e2e8f0)',
        marginBottom: '24px', background: 'var(--bg-secondary, #ffffff)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
      }}>
        {/* Panel Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={20} style={{ color: 'var(--accent-color, #0284c7)' }} />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #0f172a)', margin: 0 }}>
                Stock Relocation Workstation
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>Move packets between warehouse racks with live piece and slot synchronization</span>
            </div>
          </div>

          {(selectedMaterialId || fromLoc || toLoc) && (
            <button
              type="button"
              onClick={handleResetForm}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <X size={13} /> Reset Form
            </button>
          )}
        </div>

        {/* Success Banner if recently transferred */}
        {lastTransferSuccess && (
          <div style={{
            padding: '14px 18px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)',
            border: '1.5px solid rgba(16, 185, 129, 0.3)', marginBottom: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={20} style={{ color: '#10b981' }} />
              <div>
                <strong style={{ color: '#065f46', fontSize: '13px' }}>Transfer Completed Successfully!</strong>
                <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                  Moved <strong>{lastTransferSuccess.quantity} packet(s)</strong> of {lastTransferSuccess.materialName} ({lastTransferSuccess.materialCode}) from <strong>{lastTransferSuccess.fromLocation}</strong> to <strong>{lastTransferSuccess.toLocation}</strong>.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handlePrintTransferLabel(lastTransferSuccess)}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff',
                fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Printer size={14} /> Print Sticker
            </button>
          </div>
        )}

        {/* Form Fields Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          
          {/* Field 1: Material Selection */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="wcs-label">
              1. Select Accessory Material to Relocate <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <SearchableMaterialSelect
              materials={materials}
              value={selectedMaterialId}
              onChange={setSelectedMaterialId}
            />

            {/* Selected Material Information Card */}
            {selectedMaterial && (
              <div style={{
                marginTop: '12px', padding: '14px 18px', borderRadius: '8px',
                background: 'var(--bg-primary, #f0f7ff)', border: '1.5px solid var(--border-color, #cbd5e1)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-secondary, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color, #0284c7)' }}>
                    <Box size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', fontFamily: 'monospace', color: 'var(--accent-color, #0284c7)', background: 'rgba(2, 132, 199, 0.12)', padding: '1px 6px', borderRadius: '4px' }}>
                        {selectedMaterial.id}
                      </span>
                      <strong style={{ fontSize: '14px', color: 'var(--text-main, #0f172a)' }}>
                        {selectedMaterial.name}
                      </strong>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)', marginTop: '3px' }}>
                      Category: <strong>{selectedMaterial.category || 'General'}</strong> • Shade: <strong>{selectedMaterial.color || 'Default'}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'block' }}>Total Stock</span>
                    <strong style={{ fontSize: '15px', color: '#059669' }}>
                      {Number(selectedMaterial.stock || 0).toLocaleString()} {selectedMaterial.unit || 'Pcs'}
                    </strong>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border-color, #cbd5e1)', height: '24px' }}></div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'block' }}>Total Packets</span>
                    <strong style={{ fontSize: '15px', color: 'var(--text-main, #0f172a)' }}>
                      {selectedMaterial.packets || 1} Pkts
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Field 2: Source Rack (From) */}
          <div>
            <label className="wcs-label">
              2. Source Rack / Location (From) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            {sourceLocations.length === 0 ? (
              <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-primary, #f0f7ff)', border: '1.5px dashed var(--border-color, #cbd5e1)', color: 'var(--text-muted, #64748b)', fontSize: '12px', fontWeight: '600', textAlign: 'center' }}>
                {selectedMaterialId ? 'No active warehouse slots mapped for this material.' : 'Select an accessory material in step 1 to view source racks.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sourceLocations.map(g => {
                  const isSelected = fromLoc === g.location;
                  return (
                    <div
                      key={g.location}
                      onClick={() => {
                        setFromLoc(g.location);
                        if (transferQty > g.count) setTransferQty(g.count);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                        border: isSelected ? '1.5px solid var(--accent-color, #0284c7)' : '1.5px solid var(--border-color, #cbd5e1)',
                        background: isSelected ? 'rgba(2, 132, 199, 0.08)' : 'var(--bg-secondary, #ffffff)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={16} style={{ color: isSelected ? 'var(--accent-color, #0284c7)' : '#94a3b8' }} />
                        <span style={{ fontSize: '13px', fontWeight: isSelected ? '800' : '700', color: isSelected ? 'var(--accent-color, #0284c7)' : 'var(--text-main, #0f172a)' }}>
                          {g.location}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '11.5px', fontWeight: '800', padding: '2px 8px', borderRadius: '4px',
                        backgroundColor: isSelected ? 'var(--accent-color, #0284c7)' : 'var(--bg-primary, #f0f7ff)',
                        color: isSelected ? '#ffffff' : 'var(--text-muted, #64748b)'
                      }}>
                        {g.count} pkt{g.count > 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Field 3: Destination Rack (To) */}
          <div>
            <label className="wcs-label">
              3. Destination Rack / Slot (To) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <SearchableLocationSelect
              locations={destinationOptions}
              value={toLoc}
              onChange={setToLoc}
              placeholder="Search destination rack or type new slot..."
              allowCustom={true}
            />

            {fromLoc && toLoc && fromLoc.trim().toLowerCase() === toLoc.trim().toLowerCase() && (
              <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#dc2626', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} />
                Source and Destination rack cannot be identical.
              </div>
            )}
          </div>

          {/* Field 4: Quantity to Transfer (Manual Input) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="wcs-label" style={{ margin: 0 }}>
                4. Quantity to Transfer (Packets) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {fromLoc && (
                <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted, #64748b)' }}>
                  Available in {fromLoc}: <strong style={{ color: 'var(--text-main, #0f172a)' }}>{maxAvailable} Pkt{maxAvailable > 1 ? 's' : ''}</strong>
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min="1"
                max={maxAvailable > 0 ? maxAvailable : undefined}
                className="wcs-input"
                placeholder="Enter packet quantity (e.g. 1)"
                value={transferQty}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setTransferQty('');
                  } else {
                    const parsedVal = parseInt(val, 10);
                    setTransferQty(isNaN(parsedVal) ? '' : parsedVal);
                  }
                }}
                required
                style={{
                  height: '42px',
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#0f172a',
                  paddingRight: '75px',
                  borderColor: (Number(transferQty) > maxAvailable || (transferQty !== '' && Number(transferQty) <= 0)) ? '#ef4444' : undefined
                }}
              />
              <span style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '12px', fontWeight: '800', color: 'var(--text-muted, #64748b)', pointerEvents: 'none'
              }}>
                Packet{Number(transferQty) > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', marginTop: '6px', minHeight: '16px' }}>
              <span style={{ fontWeight: '700', color: 'var(--accent-color, #0284c7)' }}>
                {approxPcsPerPkt > 0 && Number(transferQty) > 0 ? `~${movingPcs.toLocaleString()} ${selectedMaterial?.unit || 'Pcs'} moving` : ''}
              </span>
              <span style={{ fontWeight: '700', color: Number(transferQty) > maxAvailable ? '#dc2626' : (remainingAfter > 0 ? '#059669' : '#d97706') }}>
                {Number(transferQty) > maxAvailable
                  ? `⚠️ Exceeds source stock (${maxAvailable} max)`
                  : (remainingAfter > 0 ? `Remaining at source: ${remainingAfter} Pkt${remainingAfter > 1 ? 's' : ''}` : (selectedMaterialId && fromLoc && Number(transferQty) === maxAvailable ? '⚠️ Source slot will empty' : ''))}
              </span>
            </div>
          </div>

          {/* Field 5: Operator Name / Transferred By */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="wcs-label" style={{ margin: 0 }}>
                5. Operator Name / Transferred By <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {currentUser?.name && (
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <User size={12} /> Logged in: {currentUser.name}
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="wcs-input"
                placeholder="Enter operator name (e.g. Pooja / Admin)"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                required
                style={{ paddingLeft: '36px', height: '42px', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}
              />
              <User
                size={16}
                style={{
                  position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted, #64748b)', pointerEvents: 'none'
                }}
              />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginTop: '6px', fontWeight: '600' }}>
              Person performing the transfer (recorded in audit logs & transfer sticker).
            </div>
          </div>

          {/* Live Route Transfer Trajectory Card */}
          {selectedMaterialId && fromLoc && toLoc && fromLoc.trim().toLowerCase() !== toLoc.trim().toLowerCase() && Number(transferQty) > 0 && (
            <div style={{
              gridColumn: '1 / -1', padding: '14px 18px', borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.06) 0%, rgba(16, 185, 129, 0.06) 100%)',
              border: '1.5px solid rgba(2, 132, 199, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontWeight: '800', fontSize: '13px' }}>
                <MapPin size={16} />
                <span>{fromLoc}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ height: '2px', width: '30px', background: 'var(--border-color, #cbd5e1)' }}></div>
                <div style={{
                  padding: '4px 12px', borderRadius: '9999px', background: 'var(--accent-color, #0284c7)', color: '#ffffff',
                  fontSize: '11.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '5px'
                }}>
                  Moving {transferQty} Pkt{Number(transferQty) > 1 ? 's' : ''} {operatorName ? `by ${operatorName.trim()}` : ''} <ArrowRight size={13} />
                </div>
                <div style={{ height: '2px', width: '30px', background: 'var(--border-color, #cbd5e1)' }}></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontWeight: '800', fontSize: '13px' }}>
                <MapPin size={16} />
                <span>{toLoc}</span>
              </div>
            </div>
          )}

        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleResetForm}
            className="btn btn-secondary"
            style={{ padding: '12px 20px', fontWeight: '800' }}
          >
            Clear Form
          </button>

          <button
            type="button"
            onClick={handleExecuteTransfer}
            disabled={
              submitting ||
              !selectedMaterialId ||
              !fromLoc ||
              !toLoc.trim() ||
              fromLoc.toLowerCase() === toLoc.trim().toLowerCase() ||
              !operatorName ||
              !operatorName.trim() ||
              !transferQty ||
              Number(transferQty) <= 0 ||
              Number(transferQty) > maxAvailable
            }
            style={{
              padding: '13px 28px',
              fontSize: '14.5px',
              fontWeight: '800',
              color: '#ffffff',
              background: (!submitting && selectedMaterialId && toLoc.trim() && fromLoc.toLowerCase() !== toLoc.trim().toLowerCase() && operatorName && operatorName.trim() && transferQty && Number(transferQty) > 0 && Number(transferQty) <= maxAvailable)
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : '#94a3b8',
              border: 'none',
              borderRadius: '8px',
              cursor: (!submitting && selectedMaterialId && toLoc.trim() && fromLoc.toLowerCase() !== toLoc.trim().toLowerCase() && operatorName && operatorName.trim() && transferQty && Number(transferQty) > 0 && Number(transferQty) <= maxAvailable)
                ? 'pointer'
                : 'not-allowed',
              boxShadow: (!submitting && selectedMaterialId && toLoc.trim() && fromLoc.toLowerCase() !== toLoc.trim().toLowerCase() && operatorName && operatorName.trim() && transferQty && Number(transferQty) > 0 && Number(transferQty) <= maxAvailable)
                ? '0 4px 14px rgba(16, 185, 129, 0.35)'
                : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            {submitting ? (
              <>
                <RefreshCw size={17} className="animate-spin" />
                Executing Stock Movement...
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                Execute Stock Transfer & Print
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 4. STATISTICAL METRICS RECORD (AFTER & BELOW WORKSTATION) ───────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* KPI 1 */}
        <div className="panel" style={{ padding: '16px 20px', borderRadius: '12px', border: '1.5px solid var(--border-color, #e2e8f0)', background: 'var(--bg-secondary, #ffffff)', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent-color, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeftRight size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transfers Today</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main, #0f172a)' }}>{transfersTodayList.length}</span>
              <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#059669', background: 'rgba(16, 185, 129, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                {packetsMovedToday} pkts moved
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="panel" style={{ padding: '16px 20px', borderRadius: '12px', border: '1.5px solid var(--border-color, #e2e8f0)', background: 'var(--bg-secondary, #ffffff)', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Package size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Materials Catalog</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main, #0f172a)' }}>{materials.length}</span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted, #64748b)' }}>active items</span>
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="panel" style={{ padding: '16px 20px', borderRadius: '12px', border: '1.5px solid var(--border-color, #e2e8f0)', background: 'var(--bg-secondary, #ffffff)', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MapPin size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Racks Utilized</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main, #0f172a)' }}>{distinctRacksCount}</span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted, #64748b)' }}>warehouse slots</span>
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="panel" style={{ padding: '16px 20px', borderRadius: '12px', border: '1.5px solid var(--border-color, #e2e8f0)', background: 'var(--bg-secondary, #ffffff)', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: printerStatus === 'online' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: printerStatus === 'online' ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Printer size={20} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Thermal Machine</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: printerStatus === 'online' ? '#10b981' : '#f59e0b' }} />
              <span style={{ fontSize: '13px', fontWeight: '800', color: printerStatus === 'online' ? '#059669' : 'var(--text-main, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {printerStatus === 'online' ? (printerName || 'Online (Ready)') : 'Ready to Connect'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. RECENT TRANSFER LOGS REGISTER (MATCHING MANUALLY WEIGHT CAPTURE) ─────── */}
      <div className="panel" style={{
        padding: '24px', borderRadius: '12px', border: '1.5px solid var(--border-color, #e2e8f0)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)', background: 'var(--bg-secondary, #ffffff)'
      }}>
        {/* Table Header and Global Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Menu size={20} style={{ color: '#334155' }} />
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: '900', color: 'var(--text-main, #0f172a)', margin: 0 }}>
                Recent Transfer Logs (material_transfers)
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                {filteredHistory.length} Total Relocation Record(s) Found
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                className="wcs-input"
                placeholder="Search material, rack, operator..."
                value={logSearch}
                onChange={e => { setLogSearch(e.target.value); setPage(0); }}
                style={{ paddingLeft: '34px', height: '36px', width: '220px', fontSize: '12.5px' }}
              />
              {logSearch && (
                <X size={13} style={{ position: 'absolute', right: '10px', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setLogSearch('')} />
              )}
            </div>

            {/* Time Filter Select */}
            <select
              value={timeFilter}
              onChange={e => { setTimeFilter(e.target.value); setPage(0); }}
              className="wcs-input"
              style={{ width: '130px', height: '36px', fontSize: '12px', padding: '0 8px', cursor: 'pointer' }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last 7 Days</option>
            </select>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="btn btn-secondary"
              style={{ height: '36px', padding: '0 14px', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} /> Export CSV
            </button>

            {/* Refresh */}
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="btn btn-secondary"
              style={{ height: '36px', width: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Refresh Logs"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ overflowX: 'auto', border: '1.5px solid var(--border-color, #e2e8f0)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{
                backgroundColor: 'var(--bg-primary, #f0f7ff)',
                borderBottom: '2px solid var(--border-color, #cbd5e1)',
                color: 'var(--text-main, #1e293b)',
                textAlign: 'left',
                fontWeight: '900',
                fontSize: '11px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase'
              }}>
                <th style={{ padding: '12px 14px', cursor: 'pointer', width: '140px' }} onClick={() => handleSort('transferredAt')}>
                  Date & Time {orderBy === 'transferredAt' ? (order === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '12px 14px', cursor: 'pointer', width: '130px' }} onClick={() => handleSort('materialCode')}>
                  Material Code {orderBy === 'materialCode' ? (order === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => handleSort('materialName')}>
                  Material Name {orderBy === 'materialName' ? (order === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '12px 14px' }}>From Location</th>
                <th style={{ padding: '12px 14px' }}>To Location</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', width: '90px' }}>Packets</th>
                <th style={{ padding: '12px 14px', width: '120px' }}>Operator</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', width: '100px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted, #64748b)', fontWeight: '700' }}>
                    <RefreshCw size={22} className="animate-spin" style={{ display: 'block', margin: '0 auto 8px auto', color: 'var(--accent-color, #0284c7)' }} />
                    Loading material transfers register...
                  </td>
                </tr>
              ) : paginatedHistory.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted, #64748b)', fontWeight: '700' }}>
                    <ArrowLeftRight size={30} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px auto' }} />
                    No transfer activity found matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((row, idx) => {
                  const d = row.transferredAt ? new Date(row.transferredAt) : null;
                  const isValidDate = d && !isNaN(d.getTime());
                  const dateText = isValidDate ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                  const timeText = isValidDate ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

                  return (
                    <tr
                      key={row.id || idx}
                      style={{
                        borderBottom: '1px solid var(--border-color, #e2e8f0)',
                        backgroundColor: idx % 2 === 1 ? 'rgba(240, 247, 255, 0.4)' : '#ffffff',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.05)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? 'rgba(240, 247, 255, 0.4)' : '#ffffff'}
                    >
                      {/* Date & Time */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontWeight: '800', color: 'var(--text-main, #0f172a)', display: 'block' }}>{dateText}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>{timeText}</span>
                      </td>

                      {/* Material Code */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent-color, #0284c7)',
                          border: '1px solid rgba(2, 132, 199, 0.25)', padding: '2px 8px', borderRadius: '4px',
                          fontSize: '11.5px', fontWeight: '800', fontFamily: 'monospace'
                        }}>
                          {row.materialCode}
                        </span>
                      </td>

                      {/* Material Name */}
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>
                        {row.materialName}
                      </td>

                      {/* From Location */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: '12px', fontWeight: '700', color: '#dc2626',
                          background: 'rgba(239, 68, 68, 0.08)', padding: '3px 8px', borderRadius: '4px',
                          border: '1px solid rgba(239, 68, 68, 0.2)'
                        }}>
                          {row.fromLocation}
                        </span>
                      </td>

                      {/* To Location */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: '12px', fontWeight: '700', color: '#059669',
                          background: 'rgba(16, 185, 129, 0.08)', padding: '3px 8px', borderRadius: '4px',
                          border: '1px solid rgba(16, 185, 129, 0.2)'
                        }}>
                          {row.toLocation}
                        </span>
                      </td>

                      {/* Packets */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '12px', fontWeight: '900', color: '#0284c7',
                          background: 'rgba(2, 132, 199, 0.1)', padding: '2px 8px', borderRadius: '9999px'
                        }}>
                          {row.quantity} pkt{Number(row.quantity) > 1 ? 's' : ''}
                        </span>
                      </td>

                      {/* Operator */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent-color, #0284c7)', color: '#fff', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {(row.operator || 'A')[0].toUpperCase()}
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>
                            {row.operator || 'Admin'}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handlePrintTransferLabel(row)}
                          title="Print Stock Transfer Barcode Label"
                          style={{
                            padding: '4px 10px', borderRadius: '6px',
                            border: '1px solid rgba(2, 132, 199, 0.3)', background: 'rgba(2, 132, 199, 0.08)',
                            color: 'var(--accent-color, #0284c7)', cursor: 'pointer', fontSize: '11.5px',
                            fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Printer size={13} /> Print
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted, #64748b)', fontWeight: '600' }}>
            <span>Rows per page:</span>
            <select
              value={rpp}
              onChange={e => { setRpp(Number(e.target.value)); setPage(0); }}
              className="wcs-input"
              style={{ width: '70px', height: '32px', fontSize: '12px', padding: '0 6px' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>Showing {filteredHistory.length > 0 ? page * rpp + 1 : 0}–{Math.min(filteredHistory.length, (page + 1) * rpp)} of {filteredHistory.length}</span>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '700', opacity: page === 0 ? 0.5 : 1 }}
            >
              Previous
            </button>
            <span style={{ fontSize: '12px', fontWeight: '800', padding: '0 8px', color: 'var(--text-main, #0f172a)' }}>
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '700', opacity: page >= totalPages - 1 ? 0.5 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── 6. THERMAL BARCODE LABEL PRINT MODAL ────────────────────────────────────── */}
      {printModalData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999999, padding: '20px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '14px', border: '1.5px solid #cbd5e1',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', width: '100%', maxWidth: '520px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} style={{ color: 'var(--accent-color, #0284c7)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  Stock Transfer Barcode Label
                </h3>
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: 'rgba(2, 132, 199, 0.12)', color: 'var(--accent-color, #0284c7)' }}>
                  {printModalData.stickers?.length || 1} Label(s)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPrintModalData(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', background: '#f1f5f9' }}>
              {printModalData.stickers.map((stk, idx) => (
                <div
                  key={stk.barcodeId || idx}
                  style={{
                    background: '#ffffff', padding: '14px', borderRadius: '8px',
                    border: '2px solid #000000', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    maxWidth: '380px', margin: '0 auto', width: '100%', color: '#000000'
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', margin: '0 0 10px 0', border: '1.5px solid #000000' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #000000', background: '#f4f4f4', padding: '4px 6px', fontWeight: 'bold', width: '36%' }}>BARCODE ID</td>
                        <td style={{ border: '1px solid #000000', padding: '4px 6px', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '12px' }}>{stk.barcodeId}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000000', background: '#f4f4f4', padding: '4px 6px', fontWeight: 'bold' }}>MATERIAL</td>
                        <td style={{ border: '1px solid #000000', padding: '4px 6px', fontWeight: 'bold' }}>{stk.materialName}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000000', background: '#f4f4f4', padding: '4px 6px', fontWeight: 'bold' }}>PO NO</td>
                        <td style={{ border: '1px solid #000000', padding: '4px 6px' }}>{stk.poNumber || stk.billNo || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000000', background: '#f4f4f4', padding: '4px 6px', fontWeight: 'bold' }}>WEIGHT / PCS</td>
                        <td style={{ border: '1px solid #000000', padding: '4px 6px', fontWeight: 'bold' }}>{stk.weight || stk.totalQty}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000000', background: '#f4f4f4', padding: '4px 6px', fontWeight: 'bold' }}>LOCATION</td>
                        <td style={{ border: '1px solid #000000', padding: '4px 6px', fontWeight: 'bold', color: '#059669' }}>📍 {stk.location}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000000', background: '#f4f4f4', padding: '4px 6px', fontWeight: 'bold' }}>DATE</td>
                        <td style={{ border: '1px solid #000000', padding: '4px 6px' }}>{stk.date}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #000000', background: '#f4f4f4', padding: '4px 6px', fontWeight: 'bold' }}>RECEIVED BY</td>
                        <td style={{ border: '1px solid #000000', padding: '4px 6px' }}>{stk.operator}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <BarcodeVisual code={stk.barcodeId} />
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px', borderTop: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '10px', background: '#ffffff'
            }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)', fontWeight: '600' }}>
                {printerStatus === 'online' ? `🖨️ Connected: ${printerName || 'Machine Printer'}` : '💡 Ready for direct browser & thermal printing'}
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const printWin = window.open('', '_blank', 'width=450,height=600');
                    if (!printWin) {
                      alert('Please allow popups to print label.');
                      return;
                    }
                    const cardsHtml = printModalData.stickers.map(stk => `
                      <div style="width: 2.4in; padding: 6px; border: 1.5px solid #000; box-sizing: border-box; page-break-after: always; font-family: Arial, sans-serif; background: #fff;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #000; margin-bottom: 6px;">
                          <tr><td style="border: 1px solid #000; background: #f0f0f0; padding: 2px 4px; font-weight: bold; width: 38%;">BARCODE ID</td><td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold; font-family: monospace;">${stk.barcodeId}</td></tr>
                          <tr><td style="border: 1px solid #000; background: #f0f0f0; padding: 2px 4px; font-weight: bold;">MATERIAL</td><td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">${stk.materialName}</td></tr>
                          <tr><td style="border: 1px solid #000; background: #f0f0f0; padding: 2px 4px; font-weight: bold;">PO NO</td><td style="border: 1px solid #000; padding: 2px 4px;">${stk.poNumber || stk.billNo || 'N/A'}</td></tr>
                          <tr><td style="border: 1px solid #000; background: #f0f0f0; padding: 2px 4px; font-weight: bold;">WEIGHT</td><td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">${stk.weight}</td></tr>
                          <tr><td style="border: 1px solid #000; background: #f0f0f0; padding: 2px 4px; font-weight: bold;">LOCATION</td><td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">${stk.location}</td></tr>
                          <tr><td style="border: 1px solid #000; background: #f0f0f0; padding: 2px 4px; font-weight: bold;">DATE</td><td style="border: 1px solid #000; padding: 2px 4px;">${stk.date}</td></tr>
                          <tr><td style="border: 1px solid #000; background: #f0f0f0; padding: 2px 4px; font-weight: bold;">OPERATOR</td><td style="border: 1px solid #000; padding: 2px 4px;">${stk.operator}</td></tr>
                        </table>
                        <div style="text-align: center; font-family: monospace; font-size: 11px; font-weight: bold; letter-spacing: 1px; border: 1px dashed #444; padding: 4px;">
                          |||||| |||| ||||| ||||| |||| ||||<br/>
                          ${stk.barcodeId}
                        </div>
                      </div>
                    `).join('');

                    printWin.document.write(`
                      <html>
                        <head>
                          <title>Print Transfer Barcode - ${printModalData.item.materialCode}</title>
                          <style>
                            @page { size: 2.4in 1.75in; margin: 0; }
                            body { margin: 0; padding: 4px; display: flex; flex-direction: column; align-items: center; }
                          </style>
                        </head>
                        <body>
                          ${cardsHtml}
                          <script>
                            window.onload = function() {
                              window.print();
                              setTimeout(function() { window.close(); }, 500);
                            };
                          </script>
                        </body>
                      </html>
                    `);
                    printWin.document.close();
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                    background: 'var(--accent-color, #0284c7)', color: '#ffffff',
                    fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Printer size={14} /> Print Now
                </button>

                <button
                  type="button"
                  onClick={() => setPrintModalData(null)}
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '12.5px', fontWeight: '700' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
