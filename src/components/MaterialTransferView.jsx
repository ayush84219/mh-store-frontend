import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeftRight, Search, Package, MapPin, CheckCircle,
  AlertTriangle, Clock, User, Calendar, RefreshCw, Printer, ArrowLeft,
  Plus, Minus, Check, Layers, ChevronDown, X, Sparkles, Sliders,
  ArrowRight, Download, Box, ShieldCheck, Activity
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
          padding: '11px 14px',
          minHeight: '48px',
          borderRadius: '12px',
          border: isOpen ? '1.5px solid var(--accent-color, #0284c7)' : '1.5px solid var(--border-color, #dbeafe)',
          background: 'var(--bg-secondary, #ffffff)',
          color: selectedMaterial ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #94a3b8)',
          fontSize: '0.88rem',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(2, 132, 199, 0.15)' : 'none'
        }}
      >
        {selectedMaterial ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, paddingRight: '8px' }}>
            <span style={{
              background: 'rgba(2, 132, 199, 0.12)',
              color: '#0284c7',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              padding: '2px 8px',
              borderRadius: '6px',
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
                borderRadius: '6px',
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
              borderRadius: '6px',
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
          border: '1.5px solid var(--border-color, #dbeafe)',
          borderRadius: '14px',
          boxShadow: '0 16px 36px -4px rgba(2, 132, 199, 0.15), 0 4px 12px rgba(0, 0, 0, 0.06)',
          maxHeight: '320px',
          overflowY: 'auto',
          zIndex: 100000,
          padding: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-primary, #f0f7ff)', borderRadius: '10px', border: '1px solid var(--border-color, #dbeafe)', marginBottom: '8px' }}>
            <Search size={14} style={{ color: 'var(--accent-color, #0284c7)' }} />
            <input 
              type="text" 
              placeholder="Search by code, material name, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                border: 'none',
                background: 'transparent',
                width: '100%',
                fontSize: '12.5px',
                fontWeight: '600',
                outline: 'none',
                color: 'var(--text-main, #0f172a)'
              }}
            />
            {searchQuery && (
              <X size={13} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setSearchQuery('')} />
            )}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
              No matching materials found in warehouse catalog
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
                    padding: '10px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: isSelected ? 'rgba(2, 132, 199, 0.1)' : 'transparent',
                    marginBottom: '3px',
                    border: isSelected ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid transparent'
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-primary, #f0f7ff)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', fontFamily: 'monospace', color: '#0284c7', background: 'rgba(2, 132, 199, 0.12)', padding: '1px 6px', borderRadius: '4px' }}>
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
                    <MapPin size={11} style={{ color: '#0284c7' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {loc}
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: '700', color: '#0284c7' }}>
                      {m.packets || 1} pkts
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// Barcode Renderer Component (Guaranteed crisp black/white Code-128 visual style)
const BarcodeVisual = ({ code }) => {
  const str = String(code || 'MT1000-A01');
  let currentX = 4;
  const bars = [];

  // Code 128 Start B pattern [2, 1, 1, 2, 1, 4]
  const startPattern = [2, 1, 1, 2, 1, 4];
  let isBar = true;
  startPattern.forEach((w, idx) => {
    if (isBar) {
      bars.push(<rect key={`st-${idx}`} x={currentX} y={0} width={w * 1.5} height={45} fill="#000000" />);
    }
    currentX += w * 1.5;
    isBar = !isBar;
  });

  // Render ASCII character bars with guaranteed white space gaps
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

  // Stop pattern [2, 3, 3, 1, 1, 1, 2]
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

export default function MaterialTransferView({ currentUser }) {
  const [materials, setMaterials] = useState([]);
  const [warehouseLocations, setWarehouseLocations] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [sourceLocations, setSourceLocations] = useState([]);
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [history, setHistory] = useState([]);
  const [logSearch, setLogSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [printModalData, setPrintModalData] = useState(null);
  const [lastTransferSuccess, setLastTransferSuccess] = useState(null);

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
    setLastTransferSuccess(null);
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
    
    // Parse locations string e.g. "hall 1 rack 2 (8 pkts), hall 2 rack 3 (2 pkts)"
    const parsed = parseLocationString(locStr, pkts);
    setSourceLocations(parsed);
    if (parsed.length > 0) {
      setFromLoc(parsed[0].location);
      setTransferQty(1);
    }
  }, [selectedMaterialId, materials]);

  const parseLocationString = (locStr, packetsTotal = 1) => {
    if (!locStr) return [{ location: 'Main Store', count: packetsTotal }];
    if (!locStr.includes('pkt') && !locStr.includes('(')) {
      return [{ location: locStr.trim(), count: packetsTotal }];
    }
    const parts = locStr.split(',');
    const list = [];
    parts.forEach(part => {
      const match = part.match(/(.+)\((\d+)\s*pkt/);
      if (match) {
        list.push({
          location: match[1].trim(),
          count: parseInt(match[2], 10) || 1
        });
      } else {
        list.push({
          location: part.trim(),
          count: 1
        });
      }
    });
    return list;
  };

  const serializeLocations = (groups) => {
    const active = groups.filter(g => g.location.trim() && g.count > 0);
    if (active.length === 0) return 'Main Store';
    if (active.length === 1 && active[0].count === 1) return active[0].location.trim();
    return active
      .map(g => `${g.location.trim()} (${g.count} pkt${g.count > 1 ? 's' : ''})`)
      .join(', ');
  };

  const showNotification = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleExecuteTransfer = async () => {
    if (!selectedMaterialId) {
      showNotification('Please select a material first.', 'error');
      return;
    }
    if (!fromLoc) {
      showNotification('Please select a source location.', 'error');
      return;
    }
    if (!toLoc.trim()) {
      showNotification('Please specify a destination location.', 'error');
      return;
    }
    if (fromLoc.trim().toLowerCase() === toLoc.trim().toLowerCase()) {
      showNotification('Source and destination locations cannot be the same.', 'error');
      return;
    }

    const sourceGroup = sourceLocations.find(g => g.location === fromLoc);
    if (!sourceGroup) {
      showNotification('Invalid source location selected.', 'error');
      return;
    }

    if (transferQty > sourceGroup.count) {
      showNotification(`Insufficient packet count at ${fromLoc}. Max available: ${sourceGroup.count}`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Calculate updated locations list
      let updatedGroups = sourceLocations.map(g => {
        if (g.location === fromLoc) {
          return { ...g, count: g.count - transferQty };
        }
        return g;
      });

      // Add to destination location group
      const destIndex = updatedGroups.findIndex(g => g.location.toLowerCase() === toLoc.trim().toLowerCase());
      if (destIndex !== -1) {
        updatedGroups[destIndex].count += transferQty;
      } else {
        updatedGroups.push({ location: toLoc.trim(), count: transferQty });
      }

      // Filter out zero count locations
      updatedGroups = updatedGroups.filter(g => g.count > 0);
      const newLocSummary = serializeLocations(updatedGroups);

      // 2. Send PUT request to update material's location
      const updatedMaterial = {
        ...selectedMaterial,
        location: newLocSummary
      };

      const putRes = await fetch(`${getBackendUrl()}/api/materials/${selectedMaterialId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMaterial)
      });

      if (!putRes.ok) throw new Error('Failed to update material location');

      // 3. Post transfer log to API
      const logPayload = {
        materialCode: selectedMaterialId,
        materialName: selectedMaterial.name,
        fromLocation: fromLoc,
        toLocation: toLoc.trim(),
        quantity: transferQty,
        transferType: 'packet',
        operator: currentUser?.name || 'Admin'
      };

      const logRes = await fetch(`${getBackendUrl()}/api/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logPayload)
      });

      if (!logRes.ok) throw new Error('Failed to log transfer history');

      // Save success summary for quick actions & sticker printing
      const completedTransfer = {
        id: Date.now(),
        materialCode: selectedMaterialId,
        materialName: selectedMaterial.name,
        fromLocation: fromLoc,
        toLocation: toLoc.trim(),
        quantity: transferQty,
        operator: currentUser?.name || 'Admin',
        transferredAt: new Date().toISOString()
      };
      setLastTransferSuccess(completedTransfer);

      // Automatically dismiss the success banner after exactly 3 seconds
      if (window._transferSuccessTimer) clearTimeout(window._transferSuccessTimer);
      window._transferSuccessTimer = setTimeout(() => {
        setLastTransferSuccess(null);
      }, 3000);

      showNotification(`Successfully transferred ${transferQty} packet(s) of ${selectedMaterial.name} to ${toLoc}!`);
      
      // Cleanly reset all transfer form fields
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

    // Generate accurate stickers matching Weight Capture inward addition format
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

    // Open Sticker Preview & Direct Print Modal
    setPrintModalData({
      item,
      stickers,
      material
    });

    // Also attempt Python Print Service if available
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

    // 1. Add configured warehouse locations
    if (warehouseLocations && warehouseLocations.length > 0) {
      warehouseLocations.forEach(rack => {
        const warehouse = rack.warehouse || 'Main Store';
        const rawCode = String(rack.code || '').trim();
        const label = rack.warehouse && rawCode.includes(rack.warehouse)
          ? rawCode
          : `${warehouse} - Rack ${rawCode.replace(/^rack\s*/i, '')}`;
        if (!locMap.has(label)) {
          locMap.set(label, { code: label, label, warehouse });
        }
      });
    }

    // 2. Fallback defaults if no warehouse locations in DB yet
    if (locMap.size === 0) {
      ['Main Store', 'Hall 1', 'Hall 2', 'Hall 3'].forEach(hall => {
        const count = hall === 'Main Store' ? 50 : 30;
        for (let i = 1; i <= count; i++) {
          const label = `${hall} - Rack ${i}`;
          locMap.set(label, { code: label, label, warehouse: hall });
        }
      });
    }

    return Array.from(locMap.values());
  }, [warehouseLocations]);

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

  return (
    <div style={{ padding: '20px 24px', width: '100%', maxWidth: '100%', margin: '0', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 99999,
          padding: '14px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px',
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          color: '#ffffff', fontWeight: '700', boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(8px)', animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Stats Banner: 4 Modern KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        {/* KPI 1: Transfers Today */}
        <div className="panel" style={{
          padding: '18px 20px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #dbeafe)',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(56, 189, 248, 0.1) 100%)',
            color: '#0284c7',
            flexShrink: 0
          }}>
            <ArrowLeftRight size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Transfers Today
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                {transfersTodayList.length}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669', background: 'rgba(16, 185, 129, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                {packetsMovedToday} pkts moved
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Cataloged Materials */}
        <div className="panel" style={{
          padding: '18px 20px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #dbeafe)',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(129, 140, 248, 0.1) 100%)',
            color: '#4f46e5',
            flexShrink: 0
          }}>
            <Package size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Materials Catalog
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                {materials.length}
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-muted)' }}>
                Available in stock
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Active Rack Locations */}
        <div className="panel" style={{
          padding: '18px 20px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #dbeafe)',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.1) 100%)',
            color: '#059669',
            flexShrink: 0
          }}>
            <MapPin size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Racks Utilized
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                {distinctRacksCount}
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-muted)' }}>
                Slots mapped
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Thermal Printer Status */}
        <div className="panel" style={{
          padding: '18px 20px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #dbeafe)',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: printerStatus === 'online'
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.1) 100%)'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.1) 100%)',
            color: printerStatus === 'online' ? '#059669' : '#d97706',
            flexShrink: 0
          }}>
            <Printer size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Thermal Printer
              </span>
              <button
                type="button"
                onClick={connectPrinter}
                title="Reconnect Printer"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-color, #0284c7)',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {printerStatus === 'online' ? 'Test' : 'Connect'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: printerStatus === 'online' ? '#10b981' : printerStatus === 'connecting' ? '#f59e0b' : '#ef4444',
                boxShadow: printerStatus === 'online' ? '0 0 8px #10b981' : 'none'
              }} />
              <span style={{
                fontSize: '13px',
                fontWeight: '700',
                color: printerStatus === 'online' ? '#059669' : 'var(--text-main, #0f172a)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {printerStatus === 'online' ? (printerName || 'Online (Ready)') : printerStatus === 'connecting' ? 'Connecting...' : 'Printer Ready'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(360px, 1.25fr) minmax(480px, 1.75fr)',
        gap: '24px',
        alignItems: 'start'
      }}>
        
        {/* Left Panel: Execute Transfer Workstation */}
        <div className="panel" style={{
          padding: '24px',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #dbeafe)',
          boxShadow: 'var(--shadow-card)'
        }}>
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '1px solid var(--border-color, #dbeafe)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                flexShrink: 0
              }}>
                <ArrowLeftRight size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-main, #0f172a)', letterSpacing: '-0.3px' }}>
                  Material Store Transfer
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', fontWeight: '600', marginTop: '2px', display: 'block' }}>
                  Relocate packet inventory across warehouse racks & shelves.
                </span>
              </div>
            </div>
            {(selectedMaterialId || toLoc || fromLoc) && (
              <button
                type="button"
                onClick={handleResetForm}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #dbeafe)',
                  background: 'var(--bg-primary, #f0f7ff)',
                  color: 'var(--accent-color, #0284c7)',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-primary, #f0f7ff)';
                }}
              >
                <X size={13} /> Reset Form
              </button>
            )}
          </div>

          {/* Transfer Success Banner Card */}
          {lastTransferSuccess && (
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(2, 132, 199, 0.08) 100%)',
              border: '1.5px solid rgba(16, 185, 129, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 6px 16px rgba(16, 185, 129, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={18} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#065f46' }}>
                    Stock Relocated Successfully!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLastTransferSuccess(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div>
                  <span style={{ fontWeight: '800', fontFamily: 'monospace', color: '#0284c7' }}>{lastTransferSuccess.materialCode}</span>
                  <span style={{ fontWeight: '700', color: 'var(--text-main, #0f172a)', marginLeft: '8px' }}>{lastTransferSuccess.materialName}</span>
                </div>
                <span style={{ fontWeight: '800', color: '#059669', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                  {lastTransferSuccess.quantity} pkt{lastTransferSuccess.quantity > 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: '700' }}>
                <span style={{ color: '#dc2626', background: 'rgba(239, 68, 68, 0.08)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  From: {lastTransferSuccess.fromLocation}
                </span>
                <ArrowRight size={14} style={{ color: '#94a3b8' }} />
                <span style={{ color: '#059669', background: 'rgba(16, 185, 129, 0.08)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  To: {lastTransferSuccess.toLocation}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                <button
                  type="button"
                  onClick={() => handlePrintTransferLabel(lastTransferSuccess)}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 8px rgba(2, 132, 199, 0.35)'
                  }}
                >
                  <Printer size={15} /> Print Transfer Barcode
                </button>
                <button
                  type="button"
                  onClick={() => setLastTransferSuccess(null)}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #dbeafe)',
                    background: 'var(--bg-secondary, #ffffff)',
                    color: 'var(--text-main, #0f172a)',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Transfer Another
                </button>
              </div>
            </div>
          )}

          {/* Stepper Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Step 1: Select Accessory Material */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: selectedMaterialId ? '#10b981' : 'var(--accent-color, #0284c7)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '900'
                  }}>
                    {selectedMaterialId ? <Check size={13} strokeWidth={3} /> : '1'}
                  </span>
                  SELECT ACCESSORY MATERIAL
                </label>
                {selectedMaterialId && (
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    Selected
                  </span>
                )}
              </div>

              <SearchableMaterialSelect 
                materials={materials}
                value={selectedMaterialId}
                onChange={setSelectedMaterialId}
              />

              {/* Selected Material Hero Information Preview Card */}
              {selectedMaterial && (
                <div style={{
                  marginTop: '10px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(56, 189, 248, 0.03) 100%)',
                  border: '1px solid rgba(2, 132, 199, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(2, 132, 199, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0284c7'
                    }}>
                      <Box size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', fontFamily: 'monospace', color: '#0284c7', background: 'rgba(2, 132, 199, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                          {selectedMaterial.id}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                          {selectedMaterial.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        <span>Category: <strong>{selectedMaterial.category || 'General'}</strong></span>
                        {selectedMaterial.color && <span>• Color: <strong>{selectedMaterial.color}</strong></span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: '900', color: '#059669', display: 'block' }}>
                      {Number(selectedMaterial.stock || 0).toLocaleString()} {selectedMaterial.unit || 'Pcs'}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                      {selectedMaterial.packets || 1} Total Packets
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Source Location (From) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: fromLoc ? '#10b981' : 'var(--accent-color, #0284c7)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '900'
                  }}>
                    {fromLoc ? <Check size={13} strokeWidth={3} /> : '2'}
                  </span>
                  TRANSFER FROM LOCATION (SOURCE)
                </label>
                {fromLoc && (
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', background: 'rgba(239, 68, 68, 0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                    Source Set
                  </span>
                )}
              </div>

              {sourceLocations.length === 0 ? (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'var(--bg-primary, #f0f7ff)',
                  color: 'var(--text-muted, #64748b)',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  border: '1.5px dashed var(--border-color, #dbeafe)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Package size={22} style={{ opacity: 0.4, color: 'var(--accent-color, #0284c7)' }} />
                  <span>
                    {selectedMaterialId ? 'No source rack locations mapped for this item in warehouse.' : 'Select an accessory material in step 1 to view source rack locations.'}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
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
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: isSelected ? '1.5px solid var(--accent-color, #0284c7)' : '1px solid var(--border-color, #dbeafe)',
                          background: isSelected ? 'rgba(2, 132, 199, 0.08)' : 'var(--bg-secondary, #ffffff)',
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                          boxShadow: isSelected ? '0 0 0 2px rgba(2, 132, 199, 0.15)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <MapPin size={15} style={{ color: isSelected ? '#0284c7' : '#94a3b8', flexShrink: 0 }} />
                          <span style={{ fontSize: '12.5px', fontWeight: isSelected ? '800' : '700', color: isSelected ? '#0284c7' : 'var(--text-main, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {g.location}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? '#0284c7' : 'var(--bg-primary, #f0f7ff)',
                          color: isSelected ? '#ffffff' : 'var(--text-muted, #64748b)',
                          flexShrink: 0,
                          marginLeft: '6px'
                        }}>
                          {g.count} pkt{g.count > 1 ? 's' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 3: Destination Location (To) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: (toLoc && fromLoc.toLowerCase() !== toLoc.toLowerCase()) ? '#10b981' : 'var(--accent-color, #0284c7)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '900'
                  }}>
                    {(toLoc && fromLoc.toLowerCase() !== toLoc.toLowerCase()) ? <Check size={13} strokeWidth={3} /> : '3'}
                  </span>
                  DESTINATION RACK / SLOT (TO)
                </label>
                {toLoc && fromLoc.toLowerCase() !== toLoc.toLowerCase() && (
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    Target Set
                  </span>
                )}
              </div>

              <SearchableLocationSelect
                locations={destinationOptions}
                value={toLoc}
                onChange={setToLoc}
                placeholder="Search destination rack, hall, or custom slot..."
                allowCustom={true}
              />

              {fromLoc && toLoc && fromLoc.trim().toLowerCase() === toLoc.trim().toLowerCase() && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertTriangle size={14} />
                  Source and Destination rack cannot be identical.
                </div>
              )}
            </div>

            {/* Step 4: Transfer Quantity */}
            <div>
              {(() => {
                const maxAvailable = sourceLocations.find(g => g.location === fromLoc)?.count || 1;
                const totalPkts = selectedMaterial?.packets || maxAvailable;
                const approxPcsPerPkt = selectedMaterial ? Math.round(Number(selectedMaterial.stock || 0) / Math.max(1, totalPkts)) : 0;
                const movingPcs = transferQty * approxPcsPerPkt;
                const remainingAfter = Math.max(0, maxAvailable - transferQty);

                return (
                  <div style={{
                    padding: '16px',
                    borderRadius: '14px',
                    backgroundColor: 'var(--bg-primary, #f0f7ff)',
                    border: '1px solid var(--border-color, #dbeafe)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: 'var(--accent-color, #0284c7)',
                          color: '#ffffff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '900'
                        }}>
                          4
                        </span>
                        QUANTITY TO TRANSFER
                      </label>
                      <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted, #64748b)' }}>
                        Available: <strong style={{ color: 'var(--text-main, #0f172a)' }}>{maxAvailable} Pkt{maxAvailable > 1 ? 's' : ''}</strong>
                      </span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Quick Presets:</span>
                      {[1, 2, 5].filter(q => q <= maxAvailable).map(q => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setTransferQty(q)}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            border: transferQty === q ? '1px solid var(--accent-color, #0284c7)' : '1px solid var(--border-color, #dbeafe)',
                            backgroundColor: transferQty === q ? '#0284c7' : 'var(--bg-secondary, #ffffff)',
                            color: transferQty === q ? '#ffffff' : 'var(--text-main, #0f172a)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {q} Pkt{q > 1 ? 's' : ''}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setTransferQty(maxAvailable)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '800',
                          border: transferQty === maxAvailable ? '1px solid #059669' : '1px solid var(--border-color, #dbeafe)',
                          backgroundColor: transferQty === maxAvailable ? '#059669' : 'var(--bg-secondary, #ffffff)',
                          color: transferQty === maxAvailable ? '#ffffff' : '#059669',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        All ({maxAvailable} Pkts)
                      </button>
                    </div>

                    {/* Quantity Stepper & Readout */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-secondary, #ffffff)',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color, #dbeafe)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setTransferQty(prev => Math.max(1, prev - 1))}
                          disabled={transferQty <= 1}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #dbeafe)',
                            background: 'var(--bg-primary, #f0f7ff)',
                            color: 'var(--text-main)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: transferQty <= 1 ? 'not-allowed' : 'pointer',
                            opacity: transferQty <= 1 ? 0.4 : 1
                          }}
                        >
                          <Minus size={14} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <input
                            type="number"
                            min="1"
                            max={maxAvailable}
                            value={transferQty}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(maxAvailable, parseInt(e.target.value, 10) || 1));
                              setTransferQty(val);
                            }}
                            style={{
                              width: '54px',
                              textAlign: 'center',
                              fontSize: '1.4rem',
                              fontWeight: '900',
                              color: '#0284c7',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent'
                            }}
                          />
                          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>
                            {transferQty === 1 ? 'Packet' : 'Packets'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setTransferQty(prev => Math.min(maxAvailable, prev + 1))}
                          disabled={transferQty >= maxAvailable}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #dbeafe)',
                            background: 'var(--bg-primary, #f0f7ff)',
                            color: 'var(--text-main)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: transferQty >= maxAvailable ? 'not-allowed' : 'pointer',
                            opacity: transferQty >= maxAvailable ? 0.4 : 1
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        {approxPcsPerPkt > 0 && (
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#0284c7' }}>
                            ~{movingPcs.toLocaleString()} {selectedMaterial?.unit || 'Pcs'}
                          </div>
                        )}
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: remainingAfter > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          color: remainingAfter > 0 ? '#059669' : '#d97706',
                          display: 'inline-block',
                          marginTop: '2px'
                        }}>
                          {remainingAfter > 0 ? `Remaining: ${remainingAfter} pkts` : '⚠️ Source slot will empty'}
                        </span>
                      </div>
                    </div>

                    {/* Smooth Range Slider */}
                    <div style={{ position: 'relative', width: '100%', padding: '4px 0' }}>
                      <input
                        type="range"
                        min="1"
                        max={maxAvailable}
                        value={transferQty}
                        onChange={(e) => setTransferQty(Number(e.target.value) || 1)}
                        style={{
                          width: '100%',
                          height: '6px',
                          accentColor: '#0284c7',
                          cursor: 'pointer',
                          display: 'block'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: '600' }}>
                        <span>1 Pkt</span>
                        <span>{maxAvailable} Pkts Max</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Visual Live Route Transfer Trajectory Card */}
            {selectedMaterialId && fromLoc && toLoc && fromLoc.trim().toLowerCase() !== toLoc.trim().toLowerCase() && (
              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
                border: '1.5px solid rgba(2, 132, 199, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontWeight: '800', fontSize: '12.5px' }}>
                  <MapPin size={15} />
                  <span>{fromLoc}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1 }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#0284c7', background: 'rgba(2, 132, 199, 0.12)', padding: '2px 8px', borderRadius: '9999px' }}>
                    Moving {transferQty} Pkt{transferQty > 1 ? 's' : ''}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', maxWidth: '140px' }}>
                    <div style={{ flex: 1, height: '2px', backgroundColor: '#0284c7', opacity: 0.4 }} />
                    <ArrowRight size={14} style={{ color: '#0284c7' }} />
                    <div style={{ flex: 1, height: '2px', backgroundColor: '#0284c7', opacity: 0.4 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontWeight: '800', fontSize: '12.5px' }}>
                  <CheckCircle size={15} />
                  <span>{toLoc}</span>
                </div>
              </div>
            )}

            {/* Execute Button */}
            <button
              type="button"
              disabled={submitting || !selectedMaterialId || !toLoc.trim() || fromLoc.toLowerCase() === toLoc.trim().toLowerCase()}
              onClick={handleExecuteTransfer}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '0.95rem',
                fontWeight: '800',
                borderRadius: '12px',
                border: 'none',
                background: (!submitting && selectedMaterialId && toLoc.trim() && fromLoc.toLowerCase() !== toLoc.trim().toLowerCase())
                  ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                  : 'var(--bg-secondary, #e2e8f0)',
                color: (!submitting && selectedMaterialId && toLoc.trim() && fromLoc.toLowerCase() !== toLoc.trim().toLowerCase())
                  ? '#ffffff'
                  : 'var(--text-muted, #94a3b8)',
                cursor: (!submitting && selectedMaterialId && toLoc.trim() && fromLoc.toLowerCase() !== toLoc.trim().toLowerCase()) ? 'pointer' : 'not-allowed',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: (!submitting && selectedMaterialId && toLoc.trim() && fromLoc.toLowerCase() !== toLoc.trim().toLowerCase())
                  ? '0 6px 18px rgba(2, 132, 199, 0.4)'
                  : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                if (!submitting && selectedMaterialId && toLoc.trim() && fromLoc.toLowerCase() !== toLoc.trim().toLowerCase()) {
                  e.currentTarget.style.transform = 'translateY(-1.5px)';
                  e.currentTarget.style.boxShadow = '0 8px 22px rgba(2, 132, 199, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                if (!submitting && selectedMaterialId && toLoc.trim()) {
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(2, 132, 199, 0.4)';
                }
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={17} className="animate-spin" />
                  Executing Stock Movement...
                </>
              ) : (
                <>
                  <ArrowLeftRight size={17} />
                  Execute Stock Transfer
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel: History and Activity Log */}
        <div className="panel" style={{
          padding: '24px',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #dbeafe)',
          boxShadow: 'var(--shadow-card)'
        }}>
          {/* Card Header & Global Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                flexShrink: 0
              }}>
                <Clock size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-main, #0f172a)', letterSpacing: '-0.3px' }}>
                    Transfer Activity Log
                  </h2>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    background: 'rgba(2, 132, 199, 0.1)',
                    color: '#0284c7',
                    padding: '2px 8px',
                    borderRadius: '9999px'
                  }}>
                    {history.length} Movements
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', fontWeight: '600', marginTop: '2px', display: 'block' }}>
                  Real-time warehouse audit log with 1-click thermal reprint.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* CSV Export Button */}
              <button
                type="button"
                onClick={handleExportCSV}
                title="Export Activity Log as CSV"
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #dbeafe)',
                  background: 'var(--bg-primary, #f0f7ff)',
                  color: 'var(--accent-color, #0284c7)',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary, #f0f7ff)'}
              >
                <Download size={13} /> Export CSV
              </button>

              {/* Refresh Button */}
              <button 
                onClick={fetchData}
                disabled={loading}
                title="Refresh log"
                style={{
                  padding: '7px 12px',
                  border: '1px solid var(--border-color, #dbeafe)',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary, #ffffff)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            background: 'var(--bg-primary, #f0f7ff)',
            padding: '10px 14px',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #dbeafe)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-secondary, #ffffff)',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #dbeafe)',
              flex: '1 1 200px',
              maxWidth: '320px'
            }}>
              <Search size={14} style={{ color: 'var(--accent-color, #0284c7)', flexShrink: 0 }} />
              <input 
                type="text"
                placeholder="Search material, location, operator..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  width: '100%',
                  fontSize: '12px',
                  fontWeight: '600',
                  outline: 'none',
                  color: 'var(--text-main, #0f172a)'
                }}
              />
              {logSearch && (
                <X size={13} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setLogSearch('')} />
              )}
            </div>

            {/* Time Filter Pills */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[
                { key: 'all', label: 'All Time' },
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'week', label: 'Last 7 Days' }
              ].map(tf => {
                const isActive = timeFilter === tf.key;
                return (
                  <button
                    key={tf.key}
                    type="button"
                    onClick={() => setTimeFilter(tf.key)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: isActive ? '1px solid var(--accent-color, #0284c7)' : '1px solid transparent',
                      background: isActive ? '#0284c7' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--text-muted, #64748b)',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity Log Table */}
          {(() => {
            const filteredHistory = history.filter(item => {
              if (logSearch.trim()) {
                const q = logSearch.toLowerCase().trim();
                const matchStr = `${item.materialCode || ''} ${item.materialName || ''} ${item.fromLocation || ''} ${item.toLocation || ''} ${item.operator || ''}`.toLowerCase();
                if (!matchStr.includes(q)) return false;
              }

              if (timeFilter !== 'all' && item.transferredAt) {
                const itemDate = new Date(item.transferredAt);
                const now = new Date();
                if (timeFilter === 'today') {
                  if (itemDate.toDateString() !== now.toDateString()) return false;
                } else if (timeFilter === 'yesterday') {
                  const yesterday = new Date(now);
                  yesterday.setDate(now.getDate() - 1);
                  if (itemDate.toDateString() !== yesterday.toDateString()) return false;
                } else if (timeFilter === 'week') {
                  const sevenDaysAgo = new Date(now);
                  sevenDaysAgo.setDate(now.getDate() - 7);
                  if (itemDate < sevenDaysAgo) return false;
                }
              }
              return true;
            });

            return (
              <div style={{
                overflowX: 'auto',
                flex: 1,
                border: '1px solid var(--border-color, #dbeafe)',
                borderRadius: '12px',
                background: 'var(--bg-secondary, #ffffff)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{
                      backgroundColor: 'var(--bg-primary, #f0f7ff)',
                      borderBottom: '1.5px solid var(--border-color, #dbeafe)',
                      color: 'var(--text-muted, #64748b)',
                      textAlign: 'left',
                      fontWeight: '800',
                      fontSize: '11px',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase'
                    }}>
                      <th style={{ padding: '12px 14px', width: '140px' }}>Date & Time</th>
                      <th style={{ padding: '12px 14px' }}>Accessory Material</th>
                      <th style={{ padding: '12px 14px' }}>From</th>
                      <th style={{ padding: '12px 14px' }}>To</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center', width: '80px' }}>Packets</th>
                      <th style={{ padding: '12px 14px', width: '110px' }}>Operator</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center', width: '90px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontWeight: '700' }}>
                          <RefreshCw size={24} className="animate-spin" style={{ display: 'block', margin: '0 auto 8px auto', color: '#0284c7' }} />
                          Loading warehouse transfer records...
                        </td>
                      </tr>
                    ) : filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontWeight: '600' }}>
                          <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--bg-primary, #f0f7ff)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 12px auto',
                            color: '#0284c7'
                          }}>
                            <ArrowLeftRight size={26} />
                          </div>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-main, #0f172a)', display: 'block', marginBottom: '4px' }}>
                            {logSearch || timeFilter !== 'all' ? 'No Movements Found Matching Filters' : 'No Material Transfers Logged Yet'}
                          </span>
                          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                            Perform a stock transfer on the left to create live records and barcode thermal stickers.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((item, idx) => {
                        const d = item.transferredAt ? new Date(item.transferredAt) : null;
                        const isValidDate = d && !isNaN(d.getTime());
                        const dateText = isValidDate ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                        const timeText = isValidDate ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                        const isJustTransferred = lastTransferSuccess && String(item.materialCode) === String(lastTransferSuccess.materialCode) && item.toLocation === lastTransferSuccess.toLocation && idx === 0;

                        return (
                          <tr key={item.id || idx} style={{
                            borderBottom: '1px solid var(--border-color, #edf4fc)',
                            color: 'var(--text-main)',
                            fontWeight: '600',
                            backgroundColor: isJustTransferred ? 'rgba(16, 185, 129, 0.06)' : idx % 2 === 1 ? 'rgba(240, 247, 255, 0.4)' : 'transparent',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isJustTransferred ? 'rgba(16, 185, 129, 0.06)' : idx % 2 === 1 ? 'rgba(240, 247, 255, 0.4)' : 'transparent'}
                          >
                            {/* Date & Time Column */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontWeight: '800', fontSize: '12.5px', color: 'var(--text-main)' }}>
                                    {dateText}
                                  </span>
                                  {isJustTransferred && (
                                    <span style={{ fontSize: '9px', background: '#10b981', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                                      NEW
                                    </span>
                                  )}
                                </div>
                                {timeText && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <Clock size={10} style={{ color: '#0284c7' }} /> {timeText}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Material Column */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  background: 'rgba(2, 132, 199, 0.1)',
                                  color: '#0284c7',
                                  border: '1px solid rgba(2, 132, 199, 0.25)',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  fontFamily: 'monospace'
                                }}>
                                  {item.materialCode}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                                  {item.materialName}
                                </span>
                              </div>
                            </td>

                            {/* From Location Column */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                color: '#dc2626',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                fontWeight: '700',
                                fontSize: '12px',
                                whiteSpace: 'nowrap'
                              }}>
                                <MapPin size={12} />
                                <span>{item.fromLocation || 'Unknown'}</span>
                              </div>
                            </td>

                            {/* To Location Column */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: 'rgba(16, 185, 129, 0.08)',
                                color: '#059669',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                fontWeight: '700',
                                fontSize: '12px',
                                whiteSpace: 'nowrap'
                              }}>
                                <MapPin size={12} />
                                <span>{item.toLocation || 'Unknown'}</span>
                              </div>
                            </td>

                            {/* Quantity Column */}
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <span style={{
                                background: 'rgba(2, 132, 199, 0.1)',
                                color: '#0284c7',
                                border: '1px solid rgba(2, 132, 199, 0.2)',
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontWeight: '800',
                                fontSize: '12px'
                              }}>
                                {item.quantity} pkt{Number(item.quantity) > 1 ? 's' : ''}
                              </span>
                            </td>

                            {/* Operator Column */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                  color: '#ffffff',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {(item.operator || 'A').slice(0, 1).toUpperCase()}
                                </div>
                                <span style={{
                                  fontSize: '12px',
                                  color: 'var(--text-main)',
                                  fontWeight: '700',
                                  textTransform: 'capitalize'
                                }}>
                                  {item.operator || 'System'}
                                </span>
                              </div>
                            </td>

                            {/* Action / Print Button */}
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <button
                                onClick={() => handlePrintTransferLabel(item)}
                                title="Print Stock Transfer Barcode Label"
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(2, 132, 199, 0.3)',
                                  background: 'rgba(2, 132, 199, 0.08)',
                                  color: '#0284c7',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: '800',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#0284c7';
                                  e.currentTarget.style.color = '#ffffff';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.08)';
                                  e.currentTarget.style.color = '#0284c7';
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
            );
          })()}
        </div>

      </div>

      {/* Transfer Sticker Print Modal */}
      {printModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--panel-bg, #ffffff)',
            borderRadius: '16px',
            border: '1.5px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            width: '100%',
            maxWidth: '540px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color, #dbeafe)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-primary, #f0f7ff)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} style={{ color: 'var(--accent-color, #0284c7)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                  Stock Transfer Barcode Label
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(2, 132, 199, 0.12)',
                  color: '#0284c7'
                }}>
                  {printModalData.stickers?.length || 1} Packet Label(s)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPrintModalData(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted, #64748b)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Sticker Previews */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc' }}>
              {printModalData.stickers.map((stk, idx) => (
                <div
                  key={stk.barcodeId || idx}
                  className="thermal-sticker-card"
                  style={{
                    background: '#ffffff',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '2px solid #000000',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    maxWidth: '380px',
                    margin: '0 auto',
                    width: '100%',
                    fontFamily: 'Arial, sans-serif',
                    color: '#000000'
                  }}
                >
                  {/* Exact 2.4" x 1.75" Thermal Grid Layout */}
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

                  {/* 1D Barcode with code text */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <BarcodeVisual code={stk.barcodeId} />
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer Controls */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-color, #dbeafe)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              background: 'var(--bg-secondary, #ffffff)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
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
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)'
                  }}
                >
                  <Printer size={15} /> Print Labels Now
                </button>

                <button
                  type="button"
                  onClick={() => setPrintModalData(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #dbeafe)',
                    background: 'var(--bg-secondary, #ffffff)',
                    color: 'var(--text-main, #0f172a)',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
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
