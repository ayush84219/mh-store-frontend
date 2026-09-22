import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeftRight, Search, Package, MapPin, CheckCircle,
  AlertTriangle, Clock, User, Calendar, RefreshCw, Printer, ArrowLeft,
  Plus, Minus, Check, Layers, ChevronDown, X
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
          minHeight: '46px',
          borderRadius: '12px',
          border: isOpen ? '1.5px solid #6366f1' : '1.5px solid var(--border-color, #cbd5e1)',
          background: 'var(--bg-primary, #ffffff)',
          color: selectedMaterial ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #94a3b8)',
          fontSize: '0.9rem',
          transition: 'all 0.2s ease',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(99, 102, 241, 0.15)' : 'none'
        }}
      >
        {selectedMaterial ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, paddingRight: '8px' }}>
            <span style={{
              background: 'rgba(99, 102, 241, 0.12)',
              color: '#4f46e5',
              padding: '2px 7px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '800',
              flexShrink: 0
            }}>
              {selectedMaterial.id}
            </span>
            <span style={{ fontWeight: '700', color: 'var(--text-main, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedMaterial.name}
            </span>
            <span style={{
              fontSize: '11.5px',
              fontWeight: '600',
              color: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              padding: '2px 8px',
              borderRadius: '6px',
              flexShrink: 0,
              marginLeft: 'auto'
            }}>
              {selectedMaterial.stock} {selectedMaterial.unit || 'Pcs'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted, #94a3b8)' }}>
            <Package size={15} style={{ color: '#6366f1' }} />
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
          background: 'var(--panel-bg, #ffffff)',
          border: '1.5px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          boxShadow: '0 12px 30px -4px rgba(0,0,0,0.18), 0 4px 10px rgba(0,0,0,0.08)',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 100000,
          padding: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', marginBottom: '6px' }}>
            <Search size={14} style={{ color: '#6366f1' }} />
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
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              No matching materials found
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
                    padding: '9px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    marginBottom: '3px',
                    border: isSelected ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent'
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary, #f1f5f9)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#6366f1', background: 'rgba(99, 102, 241, 0.08)', padding: '1px 6px', borderRadius: '4px' }}>
                        {m.id}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>
                        {m.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#10b981' }}>
                      {m.stock} {m.unit || 'Pcs'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                    <MapPin size={11} style={{ color: '#6366f1' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {loc}
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: '600' }}>
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
    setTimeout(() => setToast(null), 5000);
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

      showNotification(`Successfully transferred ${transferQty} packet(s) of ${selectedMaterial.name} to ${toLoc}!`);
      
      // Reset form & Refresh
      setToLoc('');
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

  return (
    <div style={{ padding: '24px 20px', width: '100%', maxWidth: '100%', margin: '0', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 99999,
          padding: '14px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px',
          background: toast.type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(16,185,129,0.95)',
          color: '#ffffff', fontWeight: '700', boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
          backdropFilter: 'blur(8px)', animation: 'slideIn 0.3s ease'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px' }}>
        
        {/* Left Panel: Execute Transfer */}
        <div className="panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
              <ArrowLeftRight size={20} style={{ color: '#6366f1' }} /> Material Store Transfer
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
              Relocate packet inventory across warehouse racks & shelves.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Step 1: Select Material */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                1. SELECT ACCESSORY MATERIAL
              </label>
              <SearchableMaterialSelect 
                materials={materials}
                value={selectedMaterialId}
                onChange={setSelectedMaterialId}
              />
            </div>

            {selectedMaterial && (
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Current Stock Status
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '900', color: 'var(--text-main)' }}>
                    {selectedMaterial.stock} {selectedMaterial.unit}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                    ({selectedMaterial.packets || 1} Total Packets)
                  </span>
                </div>
              </div>
            )}

            {/* Step 2: From Location */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                2. TRANSFER FROM LOCATION
              </label>
              {sourceLocations.length === 0 ? (
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-secondary, #f8fafc)', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem', fontWeight: '600', border: '1.5px solid var(--border-color, #e2e8f0)' }}>
                  No active source location
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: isSelected ? '1.5px solid #6366f1' : '1.5px solid var(--border-color, #e2e8f0)',
                          background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-primary, #ffffff)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MapPin size={14} style={{ color: isSelected ? '#6366f1' : 'var(--text-muted, #64748b)' }} />
                          <span style={{ fontSize: '13px', fontWeight: isSelected ? '800' : '600', color: isSelected ? '#4338ca' : 'var(--text-main, #0f172a)' }}>
                            {g.location}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '11.5px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? '#6366f1' : 'var(--bg-secondary, #f1f5f9)',
                          color: isSelected ? '#ffffff' : 'var(--text-muted, #64748b)'
                        }}>
                          {g.count} pkt{g.count > 1 ? 's' : ''} available
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 3: Destination Location */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                3. DESTINATION LOCATION / RACK
              </label>
              <SearchableLocationSelect
                locations={destinationOptions}
                value={toLoc}
                onChange={setToLoc}
                placeholder="Search destination rack or slot..."
                allowCustom={true}
              />
            </div>

            {/* Step 4: Transfer Quantity with Stepper and Quick Presets */}
            <div>
              {(() => {
                const maxAvailable = sourceLocations.find(g => g.location === fromLoc)?.count || 1;
                const totalPkts = selectedMaterial?.packets || maxAvailable;
                const approxPcsPerPkt = selectedMaterial ? Math.round(Number(selectedMaterial.stock || 0) / Math.max(1, totalPkts)) : 0;
                const remainingAfter = Math.max(0, maxAvailable - transferQty);

                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', margin: 0 }}>
                        4. PACKETS COUNT TO TRANSFER
                      </label>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#6366f1' }}>
                        Max Available: {maxAvailable} pkt{maxAvailable > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Stepper Control */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setTransferQty(prev => Math.max(1, prev - 1))}
                        disabled={transferQty <= 1}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--border-color, #cbd5e1)',
                          background: 'var(--bg-primary, #ffffff)',
                          cursor: transferQty <= 1 ? 'not-allowed' : 'pointer',
                          opacity: transferQty <= 1 ? 0.4 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-main, #0f172a)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Minus size={16} />
                      </button>

                      <input 
                        type="number"
                        min="1"
                        max={maxAvailable}
                        value={transferQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (isNaN(val) || val < 1) setTransferQty(1);
                          else if (val > maxAvailable) setTransferQty(maxAvailable);
                          else setTransferQty(val);
                        }}
                        style={{
                          flex: 1,
                          height: '42px',
                          padding: '0 12px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--border-color, #cbd5e1)',
                          background: 'var(--bg-primary, #ffffff)',
                          fontSize: '1.05rem',
                          fontWeight: '800',
                          color: 'var(--text-main, #0f172a)',
                          textAlign: 'center',
                          outline: 'none'
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => setTransferQty(prev => Math.min(maxAvailable, prev + 1))}
                        disabled={transferQty >= maxAvailable}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--border-color, #cbd5e1)',
                          background: 'var(--bg-primary, #ffffff)',
                          cursor: transferQty >= maxAvailable ? 'not-allowed' : 'pointer',
                          opacity: transferQty >= maxAvailable ? 0.4 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-main, #0f172a)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      {[1, 2, 5].filter(q => q <= maxAvailable).map(q => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setTransferQty(q)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: transferQty === q ? '1px solid #6366f1' : '1px solid var(--border-color, #e2e8f0)',
                            background: transferQty === q ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-secondary, #f8fafc)',
                            color: transferQty === q ? '#4f46e5' : 'var(--text-muted, #64748b)',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          {q} Pkt{q > 1 ? 's' : ''}
                        </button>
                      ))}
                      {maxAvailable > 2 && (
                        <button
                          type="button"
                          onClick={() => setTransferQty(Math.max(1, Math.floor(maxAvailable / 2)))}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color, #e2e8f0)',
                            background: 'var(--bg-secondary, #f8fafc)',
                            color: 'var(--text-muted, #64748b)',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Half (50%)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setTransferQty(maxAvailable)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: transferQty === maxAvailable ? '1px solid #10b981' : '1px solid var(--border-color, #e2e8f0)',
                          background: transferQty === maxAvailable ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary, #f8fafc)',
                          color: transferQty === maxAvailable ? '#059669' : 'var(--text-muted, #64748b)',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          marginLeft: 'auto'
                        }}
                      >
                        All ({maxAvailable} pkts)
                      </button>
                    </div>

                    {/* Calculation Preview Box */}
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(99, 102, 241, 0.04)',
                      border: '1px solid rgba(99, 102, 241, 0.12)',
                      fontSize: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ color: 'var(--text-main, #0f172a)', fontWeight: '700' }}>
                        Moving: <strong style={{ color: '#4f46e5' }}>{transferQty} pkt{transferQty > 1 ? 's' : ''}</strong> {approxPcsPerPkt > 0 ? `(~${(transferQty * approxPcsPerPkt).toLocaleString()} ${selectedMaterial?.unit || 'Pcs'})` : ''}
                      </span>
                      <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: '600' }}>
                        Remaining at source: <strong style={{ color: remainingAfter > 0 ? '#10b981' : '#f59e0b' }}>{remainingAfter} pkts</strong>
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Visual Live Route Transfer Card */}
            {selectedMaterialId && fromLoc && toLoc && (
              <div style={{
                padding: '12px',
                borderRadius: '10px',
                background: fromLoc.toLowerCase() === toLoc.toLowerCase() ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.06)',
                border: `1px solid ${fromLoc.toLowerCase() === toLoc.toLowerCase() ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4338ca' }}>
                    <MapPin size={13} /> {fromLoc}
                  </div>
                  <ArrowLeftRight size={13} style={{ color: 'var(--text-muted)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669' }}>
                    <MapPin size={13} /> {toLoc}
                  </div>
                </div>
                {fromLoc.toLowerCase() === toLoc.toLowerCase() && (
                  <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700' }}>
                    ⚠️ Source and destination rack cannot be the same.
                  </span>
                )}
              </div>
            )}

            {/* Execute Button */}
            <button
              type="button"
              disabled={submitting || !selectedMaterialId || !toLoc.trim() || fromLoc.toLowerCase() === toLoc.trim().toLowerCase()}
              onClick={handleExecuteTransfer}
              style={{
                width: '100%', padding: '13px', fontSize: '0.95rem', fontWeight: '800',
                borderRadius: '12px', border: 'none', background: '#6366f1', color: '#ffffff',
                cursor: (!submitting && selectedMaterialId && toLoc.trim() && fromLoc.toLowerCase() !== toLoc.trim().toLowerCase()) ? 'pointer' : 'not-allowed',
                marginTop: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: (!submitting && selectedMaterialId && toLoc.trim()) ? '0 4px 14px rgba(99,102,241,0.35)' : 'none',
                opacity: (!submitting && selectedMaterialId && toLoc.trim() && fromLoc.toLowerCase() !== toLoc.trim().toLowerCase()) ? 1 : 0.6,
                transition: 'all 0.2s ease'
              }}
            >
              <ArrowLeftRight size={16} />
              {submitting ? 'Executing Transfer...' : `Execute Transfer (${transferQty} Packet${transferQty > 1 ? 's' : ''})`}
            </button>
          </div>
        </div>

        {/* Right Panel: History and List */}
        <div className="panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <Clock size={20} style={{ color: '#10b981' }} /> Transfer Activity Log
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                Track and print receipts for recent warehouse stock movements.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={connectPrinter}
                style={{
                  padding: '6px 12px',
                  border: `1.5px solid ${printerStatus === 'online' ? 'rgba(16,185,129,0.25)' : printerStatus === 'connecting' ? 'rgba(251,191,36,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  borderRadius: '8px',
                  background: printerStatus === 'online' ? 'rgba(16,185,129,0.1)' : printerStatus === 'connecting' ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)',
                  color: printerStatus === 'online' ? '#10b981' : printerStatus === 'connecting' ? '#f59e0b' : '#ef4444',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                title="Click to reconnect print service"
              >
                <Printer size={12} />
                {printerStatus === 'online' ? `Printer: ${printerName || 'Connected'}` : printerStatus === 'connecting' ? 'Connecting...' : 'Connect Printer'}
              </button>

              <button 
                onClick={fetchData}
                disabled={loading}
                style={{
                  padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '8px',
                  background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: '700',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {/* Search and Time Filter Bar */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', background: 'var(--bg-secondary, #f8fafc)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary, #ffffff)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', flex: '1 1 200px', maxWidth: '320px' }}>
              <Search size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
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

            {/* Time Filter Tabs */}
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
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: isActive ? '1px solid #6366f1' : '1px solid transparent',
                      background: isActive ? '#6366f1' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--text-muted, #64748b)',
                      fontSize: '11.5px',
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
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left', fontWeight: '800' }}>
                      <th style={{ padding: '10px 8px', width: '130px' }}>Date & Time</th>
                      <th style={{ padding: '10px 8px' }}>Material</th>
                      <th style={{ padding: '10px 8px' }}>From</th>
                      <th style={{ padding: '10px 8px' }}>To</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', width: '80px' }}>Packets</th>
                      <th style={{ padding: '10px 8px', width: '90px' }}>Operator</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', width: '70px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontWeight: '700' }}>
                          Loading transfers log...
                        </td>
                      </tr>
                    ) : filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)', fontWeight: '600' }}>
                          <Clock size={28} style={{ display: 'block', margin: '0 auto 8px auto', opacity: 0.3 }} />
                          {logSearch || timeFilter !== 'all' ? 'No transfers match the selected filter.' : 'No material transfers logged yet.'}
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map(item => {
                        const d = item.transferredAt ? new Date(item.transferredAt) : null;
                        const isValidDate = d && !isNaN(d.getTime());
                        const dateText = isValidDate ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                        const timeText = isValidDate ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: '600' }}>
                            {/* Date & Time Column */}
                            <td style={{ padding: '10px 8px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                                  {dateText}
                                </span>
                                {timeText && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <Clock size={10} style={{ color: '#6366f1' }} /> {timeText}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Material Column */}
                            <td style={{ padding: '10px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  background: 'rgba(99, 102, 241, 0.1)',
                                  color: '#4f46e5',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: '800'
                                }}>
                                  {item.materialCode}
                                </span>
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)' }}>
                                  {item.materialName}
                                </span>
                              </div>
                            </td>

                            {/* From Location Column */}
                            <td style={{ padding: '10px 8px' }}>
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                color: '#dc2626',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: '700',
                                fontSize: '0.75rem',
                                whiteSpace: 'nowrap'
                              }}>
                                <MapPin size={11} />
                                <span>{item.fromLocation || 'Unknown'}</span>
                              </div>
                            </td>

                            {/* To Location Column */}
                            <td style={{ padding: '10px 8px' }}>
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(16, 185, 129, 0.08)',
                                color: '#059669',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: '700',
                                fontSize: '0.75rem',
                                whiteSpace: 'nowrap'
                              }}>
                                <MapPin size={11} />
                                <span>{item.toLocation || 'Unknown'}</span>
                              </div>
                            </td>

                            {/* Quantity Column */}
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <span style={{
                                background: 'rgba(99, 102, 241, 0.08)',
                                color: '#4f46e5',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: '800',
                                fontSize: '0.78rem'
                              }}>
                                {item.quantity} pkt{Number(item.quantity) > 1 ? 's' : ''}
                              </span>
                            </td>

                            {/* Operator Column */}
                            <td style={{ padding: '10px 8px' }}>
                              <span style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                fontWeight: '700',
                                textTransform: 'capitalize'
                              }}>
                                {item.operator || 'System'}
                              </span>
                            </td>

                            {/* Action / Print Button */}
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <button
                                onClick={() => handlePrintTransferLabel(item)}
                                title="Print Stock Transfer Label"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(99, 102, 241, 0.3)',
                                  background: 'rgba(99, 102, 241, 0.08)',
                                  color: '#4f46e5',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: '700',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <Printer size={12} /> Print
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
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-secondary, #f8fafc)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} style={{ color: '#6366f1' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                  Stock Transfer Barcode Label
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: '#4f46e5'
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
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', background: '#f1f5f9' }}>
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
              borderTop: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              background: 'var(--bg-secondary, #f8fafc)'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                {printerStatus === 'online' ? `🖨️ Connected: ${printerName || 'Machine Printer'}` : '💡 Ready for direct browser & USB printing'}
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
                    background: '#6366f1',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.3)'
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
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--bg-primary, #ffffff)',
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
