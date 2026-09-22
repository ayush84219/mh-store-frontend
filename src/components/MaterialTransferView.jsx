import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeftRight, Search, Package, MapPin, CheckCircle,
  AlertTriangle, Clock, User, Calendar, RefreshCw, Printer, ArrowLeft
} from 'lucide-react';
import SearchableLocationSelect from './SearchableLocationSelect';
import { getBackendUrl } from '../utils/api';

function SearchableMaterialSelect({ materials, value, onChange, placeholder = "— Select Material to Transfer —" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  const selectedMaterial = materials.find(m => String(m.id) === String(value));

  const getDisplayLabel = (m) => {
    if (!m) return '';
    const loc = m.location || (m.color && (m.color.toLowerCase().includes('hall') || m.color.toLowerCase().includes('rack') || m.color.toLowerCase().includes('store')) ? m.color : 'Main Store');
    return `[${m.id}] ${m.name} (${loc}) — ${m.stock} ${m.unit}`;
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
    const label = `${m.id} ${m.name} ${m.color || ''}`.toLowerCase();
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
          padding: '12px 14px',
          borderRadius: '10px',
          border: '1.5px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-primary, #f8fafc)',
          color: selectedMaterial ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #64748b)',
          fontSize: '0.9rem',
          fontWeight: '600',
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
        <span style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', display: 'inline-flex' }}>▼</span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '6px',
          background: 'var(--panel-bg, #ffffff)',
          border: '1.5px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-lg, 0 10px 25px -5px rgba(0,0,0,0.1))',
          maxHeight: '260px',
          overflowY: 'auto',
          zIndex: 10000,
          padding: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderBottom: '1px solid var(--border-color, #e2e8f0)', marginBottom: '6px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search by code, name, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                width: '100%',
                fontSize: '0.85rem',
                outline: 'none',
                color: 'var(--text-main)'
              }}
            />
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              No matching materials found
            </div>
          ) : (
            filtered.map(m => (
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
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  color: 'var(--text-main)',
                  transition: 'background 0.2s ease',
                  background: String(value) === String(m.id) ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  hover: { background: 'var(--bg-secondary)' }
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--bg-secondary, #f1f5f9)'}
                onMouseLeave={(e) => e.target.style.background = String(value) === String(m.id) ? 'rgba(99, 102, 241, 0.08)' : 'transparent'}
              >
                {getDisplayLabel(m)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function MaterialTransferView({ currentUser }) {
  const [materials, setMaterials] = useState([]);
  const [warehouseLocations, setWarehouseLocations] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [sourceLocations, setSourceLocations] = useState([]);
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

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

  const selectedMaterial = materials.find(m => m.id === selectedMaterialId);

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
    const material = materials.find(m => String(m.id) === String(item.materialCode));
    const totalToPrint = item.quantity || 1;

    let matchingCaptures = [];
    try {
      const res = await fetch(`${getBackendUrl()}/api/weight-capture`);
      if (res.ok) {
        const result = await res.json();
        const captures = result.data || [];
        matchingCaptures = captures.filter(c => String(c.materialCode) === String(item.materialCode));
      }
    } catch (err) {
      console.warn("Failed to fetch weight captures for transfer label:", err);
    }

    try {
      const pws = new WebSocket('ws://localhost:8765');
      let nextPkt = 1;

      const sendNext = () => {
        if (nextPkt > totalToPrint) {
          alert(`✅ All ${totalToPrint} sticker(s) printed via Python Print Service!`);
          pws.close();
          return;
        }

        const d = new Date();
        const printDate =
          String(d.getDate()).padStart(2, '0') + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          d.getFullYear() + ' ' +
          String(d.getHours()).padStart(2, '0') + ':' +
          String(d.getMinutes()).padStart(2, '0');

        let payload;

        if (material) {
          const totalPkts = Math.max(1, material.packets || 1);
          const pktQty = Math.round((material.stock / totalPkts) * 100) / 100;
          const pktBarcodeId = `${material.id}-A${String(nextPkt).padStart(2, '0')}`;

          const capture = matchingCaptures.find(c => c.barcodeId === pktBarcodeId)
            || matchingCaptures[nextPkt - 1]
            || matchingCaptures[0];

          const displayWeight = capture ? `${capture.netWeightKg} KG` : `${pktQty} ${material.unit || 'Pcs'}`;
          const displayPieces = capture ? String(capture.pieces) : String(pktQty);
          const displayTotalQty = capture ? `${capture.pieces} ${material.unit || 'Pcs'}` : `${material.stock} ${material.unit || 'Pcs'}`;
          const displayPo = capture?.poNumber || material.poNumber || material.po || 'N/A';
          const displayBill = capture?.invoiceNo || material.invoiceNo || material.billNo || 'N/A';
          const displayCmp = capture?.supplier || material.supplier || 'paras';

          payload = {
            type: 'print_accessory',
            data: {
              cmp: displayCmp,
              materialName: material.name,
              materialCode: material.id,
              category: material.category || 'Accessory',
              shade: material.color || 'Default',
              weight: displayWeight,
              pieces: displayPieces,
              totalQty: displayTotalQty,
              unit: material.unit || 'Pcs',
              location: item.toLocation,
              date: printDate,
              poNumber: displayPo,
              billNo: displayBill,
              lotNo: material.id,
              operator: item.operator,
              authorized: item.operator,
              packetNo: nextPkt,
              totalPackets: totalPkts,
              barcodeId: pktBarcodeId
            }
          };
        } else {
          payload = {
            type: 'print_accessory',
            data: {
              cmp: 'paras',
              materialName: item.materialName,
              materialCode: item.materialCode,
              category: 'Accessory',
              shade: 'Transfer',
              weight: `${item.quantity} Packet(s)`,
              pieces: String(item.quantity),
              totalQty: `${item.quantity} Pkt(s)`,
              unit: 'Packets',
              location: item.toLocation,
              date: printDate,
              poNumber: 'TRANSFER',
              billNo: 'N/A',
              lotNo: item.materialCode,
              operator: item.operator,
              authorized: item.operator,
              packetNo: nextPkt,
              totalPackets: totalToPrint,
              barcodeId: `${item.materialCode}-T`
            }
          };
        }

        pws.send(JSON.stringify(payload));
        nextPkt++;
      };

      pws.onopen = () => {
        pws.send(JSON.stringify({ type: 'auth', token: 'fabric-print-secret-key-2024' }));
      };

      pws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'auth_success') {
          sendNext();
        } else if (msg.type === 'print_accessory_result') {
          if (msg.success) {
            sendNext();
          } else {
            alert(`⚠️ Printer error: ${msg.message}`);
            pws.close();
          }
        }
      };
    } catch (err) {
      alert('Could not connect to print service. Make sure print_service.py is running!');
    }
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
              <label style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                2. TRANSFER FROM LOCATION
              </label>
              {sourceLocations.length === 0 ? (
                <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', border: '1.5px solid var(--border-color)' }}>
                  No active source location
                </div>
              ) : (
                <select
                  value={fromLoc}
                  onChange={(e) => setFromLoc(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '10px',
                    border: '1.5px solid var(--border-color)', background: 'var(--bg-primary)',
                    fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', outline: 'none'
                  }}
                >
                  {sourceLocations.map(g => (
                    <option key={g.location} value={g.location}>
                      {g.location} ({g.count} pkt{g.count > 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Step 3: Destination Location */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
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

            {/* Step 4: Transfer Quantity */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                4. PACKETS COUNT TO TRANSFER
              </label>
              <input 
                type="number"
                min="1"
                max={sourceLocations.find(g => g.location === fromLoc)?.count || 1}
                value={transferQty}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setTransferQty(isNaN(val) || val < 1 ? 1 : val);
                }}
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: '10px',
                  border: '1.5px solid var(--border-color)', background: 'var(--bg-primary)',
                  fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)', outline: 'none'
                }}
              />
            </div>

            {/* Execute Button */}
            <button
              type="button"
              disabled={submitting || !selectedMaterialId}
              onClick={handleExecuteTransfer}
              style={{
                width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: '800',
                borderRadius: '10px', border: 'none', background: '#6366f1', color: '#ffffff',
                cursor: selectedMaterialId ? 'pointer' : 'not-allowed', marginTop: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: selectedMaterialId ? '0 4px 14px rgba(99,102,241,0.3)' : 'none',
                opacity: selectedMaterialId ? 1 : 0.6, transition: 'all 0.2s ease'
              }}
            >
              <ArrowLeftRight size={16} />
              {submitting ? 'Executing Transfer...' : 'Execute Stock Transfer'}
            </button>
          </div>
        </div>

        {/* Right Panel: History and List */}
        <div className="panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <Clock size={20} style={{ color: '#10b981' }} /> Transfer Activity Log
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                View and print receipts of recent warehouse stock relocations.
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

          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left', fontWeight: '800' }}>
                  <th style={{ padding: '10px 8px' }}>Date</th>
                  <th style={{ padding: '10px 8px' }}>Material</th>
                  <th style={{ padding: '10px 8px' }}>From</th>
                  <th style={{ padding: '10px 8px' }}>To</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Qty (Pkts)</th>
                  <th style={{ padding: '10px 8px' }}>Operator</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Sticker</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontWeight: '700' }}>
                      Loading transfers log...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontWeight: '600' }}>
                      No material transfers logged yet.
                    </td>
                  </tr>
                ) : (
                  history.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: '600' }}>
                      <td style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {new Date(item.transferredAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ fontWeight: '800', display: 'block', fontSize: '0.8rem' }}>{item.materialCode}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.materialName}</span>
                      </td>
                      <td style={{ padding: '10px 8px', color: '#ef4444' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={12} /> {item.fromLocation}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', color: '#10b981' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={12} /> {item.toLocation}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800' }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {item.operator}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => handlePrintTransferLabel(item)}
                          style={{
                            padding: '4px 8px', borderRadius: '6px', border: '1px solid #6366f1',
                            background: 'rgba(99, 102, 241, 0.08)', color: '#6366f1', cursor: 'pointer',
                            fontSize: '0.75rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Printer size={12} /> Print
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
