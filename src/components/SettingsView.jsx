import React, { useState, useEffect, useMemo } from 'react';
import { Settings, ShieldAlert, PlusCircle, Trash2, Globe, Users, User, Edit, Package, Search, Warehouse, MapPin, CheckCircle, RefreshCw, AlertTriangle, Camera, Image as ImageIcon, Eye, Shield } from 'lucide-react';
import { getBackendUrl } from '../utils/api';

export default function SettingsView({
  vendors,
  onAddVendor,
  onDeleteVendor,
  currencySymbol,
  setCurrencySymbol,
  defaultTax,
  setDefaultTax,
  onResetDatabase,
  accessoriesList = [],
  onAddAccessory,
  onDeleteAccessory,
  designersList = [],
  onAddDesigner,
  onDeleteDesigner,
  materials = [],
  onAddMaterial,
  onDeleteMaterial,
  onUpdateMaterial,
  racks = [],
  setRacks,
  halls = [],
  setHalls,
  allowMaterialPhotoEdit = true,
  onToggleAllowMaterialPhotoEdit
}) {
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [materialsJoined, setMaterialsJoined] = useState('Fabrics & Trims');
  const [vendorError, setVendorError] = useState('');



  // Warehouse Racks & Storage Locations Management States
  const [dbLocations, setDbLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [rackSearchQuery, setRackSearchQuery] = useState('');
  const [selectedRackWarehouse, setSelectedRackWarehouse] = useState('All');
  const [isAddingRack, setIsAddingRack] = useState(false);
  const [newRackWarehouse, setNewRackWarehouse] = useState('Main Store');
  const [customRackWh, setCustomRackWh] = useState('');
  const [newRackName, setNewRackName] = useState('');
  const [newRackCapacity, setNewRackCapacity] = useState(20);
  const [rackActionMsg, setRackActionMsg] = useState(null);
  const [isDeletingRackId, setIsDeletingRackId] = useState(null);

  // Fetch live warehouse locations from backend
  const fetchLiveLocations = async () => {
    try {
      setLoadingLocations(true);
      const res = await fetch(`${getBackendUrl()}/api/warehouse-locations`);
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : (json.data || []);
        setDbLocations(list);
      }
    } catch (err) {
      console.warn('Failed to load warehouse locations in settings:', err);
    } finally {
      setLoadingLocations(false);
    }
  };

  useEffect(() => {
    fetchLiveLocations();
  }, []);

  // Compute all available locations combining DB & state
  const allLocationsList = useMemo(() => {
    const map = new Map();
    (dbLocations || []).forEach(loc => {
      const id = loc.id || loc.code;
      const wh = loc.warehouse || (String(loc.code || '').includes(' - ') ? loc.code.split(' - ')[0].trim() : 'Main Store');
      const code = String(loc.code || '').trim();
      const cap = Number(loc.capacity) || 20;
      map.set(id, { id, code, warehouse: wh, capacity: cap, source: 'db' });
    });
    (racks || []).forEach(r => {
      const wh = r.warehouse || 'Main Store';
      const rawCode = String(r.code || r.name || '').trim();
      const code = r.warehouse && rawCode.includes(r.warehouse) ? rawCode : `${wh} - Rack ${rawCode.replace(/^rack\s*/i, '')}`;
      const id = r.id || code;
      if (!map.has(id)) {
        map.set(id, { id, code, warehouse: wh, capacity: Number(r.capacity) || 20, source: 'racks' });
      }
    });
    return Array.from(map.values());
  }, [dbLocations, racks]);

  const uniqueWarehouses = useMemo(() => {
    const s = new Set();
    allLocationsList.forEach(l => {
      if (l.warehouse) s.add(l.warehouse);
    });
    ['Main Store', 'Hall 1', 'Hall 2', 'Hall 3'].forEach(h => s.add(h));
    return Array.from(s);
  }, [allLocationsList]);

  const filteredRacks = useMemo(() => {
    return allLocationsList.filter(loc => {
      const q = rackSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || loc.code.toLowerCase().includes(q) || loc.warehouse.toLowerCase().includes(q);
      const matchesWh = selectedRackWarehouse === 'All' || loc.warehouse === selectedRackWarehouse;
      return matchesSearch && matchesWh;
    });
  }, [allLocationsList, rackSearchQuery, selectedRackWarehouse]);

  // Handle Delete Rack
  const handleDeleteRack = async (loc) => {
    const identifier = loc.id || loc.code;
    const label = loc.code || identifier;
    if (!window.confirm(`Are you sure you want to delete rack "${label}"? This will remove it from all location selection menus.`)) {
      return;
    }
    setIsDeletingRackId(identifier);
    try {
      const res = await fetch(`${getBackendUrl()}/api/warehouse-locations/${encodeURIComponent(identifier)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDbLocations(prev => prev.filter(l => l.id !== identifier && l.code !== identifier && l.code !== loc.code));
        if (setRacks) {
          setRacks(prev => prev.filter(r => r.id !== identifier && r.code !== identifier && `${r.warehouse} - ${r.code}` !== loc.code));
        }
        setRackActionMsg({ type: 'success', text: `Rack "${label}" deleted successfully.` });
      } else {
        const errData = await res.json().catch(() => ({}));
        setRackActionMsg({ type: 'error', text: errData.error || 'Failed to delete rack.' });
      }
    } catch (err) {
      setRackActionMsg({ type: 'error', text: 'Server connection error: ' + err.message });
    } finally {
      setIsDeletingRackId(null);
      setTimeout(() => setRackActionMsg(null), 4000);
    }
  };

  // Handle Add Rack
  const handleAddRackSubmit = async (e) => {
    e.preventDefault();
    const finalWh = newRackWarehouse === '__custom__' ? (customRackWh.trim() || 'Main Store') : newRackWarehouse;
    const raw = newRackName.trim();
    if (!raw) return;
    const fullCode = raw.toLowerCase().includes(finalWh.toLowerCase()) ? raw : `${finalWh} - Rack ${raw.replace(/^rack\s*/i, '')}`;

    try {
      const res = await fetch(`${getBackendUrl()}/api/warehouse-locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse: finalWh,
          code: fullCode,
          capacity: Number(newRackCapacity) || 20
        })
      });
      if (res.ok) {
        await fetchLiveLocations();
        setIsAddingRack(false);
        setNewRackName('');
        setCustomRackWh('');
        setRackActionMsg({ type: 'success', text: `Rack "${fullCode}" created successfully.` });
      } else {
        const errData = await res.json().catch(() => ({}));
        setRackActionMsg({ type: 'error', text: errData.error || 'Failed to create rack.' });
      }
    } catch (err) {
      setRackActionMsg({ type: 'error', text: 'Error: ' + err.message });
    } finally {
      setTimeout(() => setRackActionMsg(null), 4000);
    }
  };

  // Handle Clear All Racks
  const handleClearAllRacks = async () => {
    if (!window.confirm('⚠️ WARNING: Are you sure you want to delete ALL warehouse racks? This cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`${getBackendUrl()}/api/warehouse-locations`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDbLocations([]);
        if (setRacks) setRacks([]);
        setRackActionMsg({ type: 'success', text: 'All warehouse racks cleared successfully.' });
      } else {
        setRackActionMsg({ type: 'error', text: 'Failed to clear warehouse racks.' });
      }
    } catch (err) {
      setRackActionMsg({ type: 'error', text: err.message });
    } finally {
      setTimeout(() => setRackActionMsg(null), 4000);
    }
  };

  // Raw Materials Catalog Management States
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [matSearchQuery, setMatSearchQuery] = useState('');
  const [matName, setMatName] = useState('');
  const [matCategory, setMatCategory] = useState('Fabric');
  const [matStock, setMatStock] = useState('');
  const [matUnit, setMatUnit] = useState('meters');
  const [matCost, setMatCost] = useState('');
  const [matThreshold, setMatThreshold] = useState('50');
  const [matColor, setMatColor] = useState('');
  const [matLocation, setMatLocation] = useState('');
  const [matError, setMatError] = useState('');

  // Handle Edit Material Update Submit
  const handleUpdateSubmit = (e) => {
    e.preventDefault();
    if (!matName.trim()) {
      setMatError('Material Name is required.');
      return;
    }
    const updated = {
      ...editingMaterial,
      name: matName.trim(),
      category: matCategory,
      stock: parseFloat(matStock) || 0,
      unit: matUnit,
      cost: parseFloat(matCost) || 0,
      threshold: parseFloat(matThreshold) || 50,
      color: matColor ? matColor.trim() : 'Default',
      location: matLocation ? matLocation.trim() : 'Main Store'
    };
    if (onUpdateMaterial) {
      onUpdateMaterial(updated);
    }
    setEditingMaterial(null);
    setMatError('');
  };

  // Handle Add Material Submit
  const handleAddMatSubmit = (e) => {
    e.preventDefault();
    if (!matName.trim()) {
      setMatError('Material Name is required.');
      return;
    }
    const newId = `M${Math.floor(1000 + Math.random() * 9000)}`;
    const newMat = {
      id: newId,
      name: matName.trim(),
      category: matCategory,
      stock: parseFloat(matStock) || 0,
      unit: matUnit,
      cost: parseFloat(matCost) || 0,
      threshold: parseFloat(matThreshold) || 50,
      color: matColor ? matColor.trim() : 'Default',
      location: matLocation ? matLocation.trim() : 'Main Store',
      packets: 1,
      poNumber: 'N/A',
      invoiceNo: 'N/A'
    };
    if (onAddMaterial) {
      onAddMaterial(newMat);
    }
    setIsAddingMaterial(false);
    setMatName('');
    setMatStock('');
    setMatCost('');
    setMatColor('');
    setMatLocation('');
    setMatError('');
  };

  // Filter materials based on Search input
  const filteredMaterials = (materials || []).filter(m => {
    const q = matSearchQuery.toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.id || '').toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q) ||
      (m.color || '').toLowerCase().includes(q) ||
      (m.location || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '22px', fontWeight: '700' }}>System Settings & Configurations</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Manage textile accessories catalog, designers directory, suppliers, Google Sheets integration, and system reset utilities.</p>
      </div>

      <div className="split-view" style={{ gridTemplateColumns: '0.9fr 1.1fr' }}>
        {/* Left Column: System Configurations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Material Photo Change & Delete Permission Control (Admin Exclusive) */}
          <div className="panel" style={{
            marginBottom: 0,
            border: allowMaterialPhotoEdit ? '1.5px solid rgba(16, 185, 129, 0.35)' : '1.5px solid rgba(99, 102, 241, 0.35)',
            background: allowMaterialPhotoEdit ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, var(--bg-primary) 100%)' : 'linear-gradient(180deg, rgba(99, 102, 241, 0.03) 0%, var(--bg-primary) 100%)'
          }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} className="text-accent" />
                Material Photo Change & Delete Permission
              </h3>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#4f46e5',
                border: '1px solid rgba(99, 102, 241, 0.2)'
              }}>
                <Shield size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Admin Only
              </span>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginBottom: '14px', lineHeight: '1.45' }}>
              Control whether operators and users can upload, change, or delete material photos in <strong>Material Details</strong>. Turn OFF to restrict to normal view-only photo preview panel.
            </p>

            <div
              onClick={() => {
                if (onToggleAllowMaterialPhotoEdit) {
                  onToggleAllowMaterialPhotoEdit(!allowMaterialPhotoEdit);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                backgroundColor: allowMaterialPhotoEdit ? 'rgba(16, 185, 129, 0.07)' : 'rgba(100, 116, 139, 0.06)',
                border: allowMaterialPhotoEdit ? '1.5px solid rgba(16, 185, 129, 0.35)' : '1.5px solid rgba(100, 116, 139, 0.22)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                userSelect: 'none',
                boxShadow: allowMaterialPhotoEdit ? '0 4px 16px rgba(16, 185, 129, 0.08)' : '0 2px 8px rgba(0,0,0,0.03)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.borderColor = allowMaterialPhotoEdit ? '#10b981' : '#64748b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = allowMaterialPhotoEdit ? 'rgba(16, 185, 129, 0.35)' : 'rgba(100, 116, 139, 0.22)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: allowMaterialPhotoEdit
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                  color: '#ffffff',
                  boxShadow: allowMaterialPhotoEdit
                    ? '0 4px 12px rgba(16, 185, 129, 0.35)'
                    : '0 3px 8px rgba(100, 116, 139, 0.25)',
                  transition: 'all 0.3s ease'
                }}>
                  {allowMaterialPhotoEdit ? <Camera size={22} /> : <Eye size={22} />}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '800',
                      color: allowMaterialPhotoEdit ? '#065f46' : 'var(--text-main)'
                    }}>
                      {allowMaterialPhotoEdit ? 'Photo Change & Delete: ACTIVE' : 'Normal View Panel: ACTIVE'}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      padding: '2px 7px',
                      borderRadius: '9999px',
                      backgroundColor: allowMaterialPhotoEdit ? '#dcfce7' : '#e2e8f0',
                      color: allowMaterialPhotoEdit ? '#15803d' : '#475569',
                      border: allowMaterialPhotoEdit ? '1px solid #86efac' : '1px solid #cbd5e1',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: allowMaterialPhotoEdit ? '#16a34a' : '#94a3b8',
                        boxShadow: allowMaterialPhotoEdit ? '0 0 6px #16a34a' : 'none'
                      }} />
                      {allowMaterialPhotoEdit ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {allowMaterialPhotoEdit
                      ? 'Users can upload, replace, or delete photos directly in Material Details.'
                      : 'Edit & delete controls are hidden. Users see the standard view-only photo preview.'}
                  </div>
                </div>
              </div>

              {/* Premium iOS-style Interactive Switch Pill */}
              <div
                style={{
                  position: 'relative',
                  width: '68px',
                  height: '36px',
                  borderRadius: '9999px',
                  background: allowMaterialPhotoEdit
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                  boxShadow: allowMaterialPhotoEdit
                    ? '0 4px 14px rgba(16, 185, 129, 0.4), inset 0 1px 2px rgba(255,255,255,0.3)'
                    : 'inset 0 2px 4px rgba(0,0,0,0.15)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '3px',
                  boxSizing: 'border-box',
                  flexShrink: 0
                }}
                title={allowMaterialPhotoEdit ? 'Click to switch OFF (Normal Panel)' : 'Click to switch ON (Allow Photo Edit/Delete)'}
              >
                {/* Track Text Indicator */}
                <span style={{
                  position: 'absolute',
                  left: '10px',
                  fontSize: '10px',
                  fontWeight: '900',
                  letterSpacing: '0.05em',
                  color: '#ffffff',
                  opacity: allowMaterialPhotoEdit ? 1 : 0,
                  transform: allowMaterialPhotoEdit ? 'scale(1)' : 'scale(0.7)',
                  transition: 'all 0.25s ease',
                  pointerEvents: 'none'
                }}>
                  ON
                </span>
                <span style={{
                  position: 'absolute',
                  right: '9px',
                  fontSize: '9.5px',
                  fontWeight: '900',
                  letterSpacing: '0.05em',
                  color: '#ffffff',
                  opacity: !allowMaterialPhotoEdit ? 1 : 0,
                  transform: !allowMaterialPhotoEdit ? 'scale(1)' : 'scale(0.7)',
                  transition: 'all 0.25s ease',
                  pointerEvents: 'none'
                }}>
                  OFF
                </span>

                {/* Sliding Knob */}
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.1)',
                    transform: `translateX(${allowMaterialPhotoEdit ? '34px' : '2px'})`,
                    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: allowMaterialPhotoEdit ? '#10b981' : '#64748b'
                  }}
                >
                  {allowMaterialPhotoEdit ? (
                    <CheckCircle size={14} style={{ color: '#10b981' }} />
                  ) : (
                    <Eye size={13} style={{ color: '#64748b' }} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Garment Accessories Catalog Configurations */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header">
              <h3 className="panel-title">
                <Settings size={18} className="text-accent" />
                Garment Accessories Catalog ({accessoriesList.length})
              </h3>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' }}>
              Define the default catalog of garment accessories. These will automatically appear as options in the Below of Material builder checklist.
            </p>

            <div style={{
              maxHeight: '220px',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-md)',
              padding: '8px',
              backgroundColor: 'var(--bg-primary)',
              marginBottom: '12px'
            }}>
              {accessoriesList.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px', textAlign: 'center' }}>
                  No accessories cataloged. Add one below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {accessoriesList.map((acc) => (
                    <div
                      key={acc}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderRadius: 'var(--border-radius-sm)',
                        backgroundColor: 'var(--accent-light)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{acc}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteAccessory(acc)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={`Remove ${acc} permanently`}
                      >
                        <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.target.elements.newAccName;
                if (input.value && input.value.trim()) {
                  onAddAccessory(input.value.trim());
                  input.value = '';
                }
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                name="newAccName"
                className="form-input"
                placeholder="e.g. Drawstring, Metal Eyelets"
                style={{ flexGrow: 1, height: '36px', fontSize: '13px' }}
                required
              />
              <button type="submit" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '36px' }}>
                <PlusCircle size={14} /> Add
              </button>
            </form>
          </div>

          {/* Designers Directory Configurations */}
          <div className="panel" style={{ marginBottom: 0 }}>
            <div className="panel-header">
              <h3 className="panel-title">
                <User size={18} className="text-accent" />
                Designers Directory ({designersList.length})
              </h3>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' }}>
              Manage system designer names. These options will populate the Designer In-charge dropdown in the Below of Material form.
            </p>

            <div style={{
              maxHeight: '220px',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-md)',
              padding: '8px',
              backgroundColor: 'var(--bg-primary)',
              marginBottom: '12px'
            }}>
              {designersList.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px', textAlign: 'center' }}>
                  No designers registered. Add one below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {designersList.map((designerName) => (
                    <div
                      key={designerName}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderRadius: 'var(--border-radius-sm)',
                        backgroundColor: 'var(--accent-light)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>{designerName}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteDesigner(designerName)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={`Remove ${designerName}`}
                      >
                        <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.target.elements.newDesignerName;
                if (input.value && input.value.trim()) {
                  onAddDesigner(input.value.trim());
                  input.value = '';
                }
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                name="newDesignerName"
                className="form-input"
                placeholder="e.g. Jane Doe, John Smith"
                style={{ flexGrow: 1, height: '36px', fontSize: '13px' }}
                required
              />
              <button type="submit" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '36px' }}>
                <PlusCircle size={14} /> Add
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Suppliers Management */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h3 className="panel-title">
              <Users size={18} className="text-accent" />
              Associated Suppliers & Vendors ({vendors.length})
            </h3>
            {!isAddingVendor && (
              <button className="btn btn-primary btn-sm" onClick={() => { setIsAddingVendor(true); setVendorError(''); }}>
                <PlusCircle size={14} /> Add Vendor
              </button>
            )}
          </div>

          {isAddingVendor && (
            <form onSubmit={handleAddVendor} className="animate-scale" style={{ marginBottom: '20px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-primary)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-main)', textTransform: 'uppercase' }}>New Vendor Information</h4>
              {vendorError && (
                <div className="auth-alert error" style={{ padding: '8px 12px', marginBottom: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                  <span>{vendorError}</span>
                </div>
              )}

              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Supplier Company Name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="email"
                  className="form-input"
                  placeholder="Contact Email Address"
                  value={vendorEmail}
                  onChange={(e) => setVendorEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Office/Factory Address"
                  value={vendorAddress}
                  onChange={(e) => setVendorAddress(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px' }}>Materials Supplied</label>
                <select
                  className="form-input"
                  value={materialsJoined}
                  onChange={(e) => setMaterialsJoined(e.target.value)}
                >
                  <option value="Fabrics & Yarn">Fabrics & Yarn</option>
                  <option value="Metal Buttons & Rivets">Buttons, Zippers & Trims</option>
                  <option value="Labels, Tags & Hangers">Labels, Tags & Hangers</option>
                  <option value="Full Apparel Accessories">Full Apparel Accessories</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAddingVendor(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Add Vendor</button>
              </div>
            </form>
          )}

          <div className="custom-table-container" style={{ maxHeight: '380px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong style={{ display: 'block', fontSize: '14px' }}>{v.name}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.email}</span>
                    </td>
                    <td>
                      <span className="status-badge" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', fontSize: '11px' }}>
                        {v.materialsJoined}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onDeleteVendor(v.id)}
                        disabled={vendors.length <= 2} // keep at least a couple default vendors
                        style={{ padding: '6px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Warehouse Racks & Storage Slots Management */}
      <div className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Warehouse size={18} className="text-accent" />
            Warehouse Racks & Storage Locations ({allLocationsList.length})
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={fetchLiveLocations}
              disabled={loadingLocations}
              title="Refresh Racks list"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RefreshCw size={13} className={loadingLocations ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setIsAddingRack(true);
                setNewRackName('');
                setNewRackCapacity(20);
                setNewRackWarehouse('Main Store');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <PlusCircle size={14} /> Add New Rack
            </button>
            {allLocationsList.length > 0 && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleClearAllRacks}
                title="Delete all configured warehouse racks"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Trash2 size={13} /> Clear All
              </button>
            )}
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '14px' }}>
          Configure, search, add, or <strong>delete warehouse racks & slots</strong>. Deleted racks will be removed in real-time from Inward Weight Capture, Manual Entry, and Material Transfer dropdowns.
        </p>

        {/* Action Status Banner */}
        {rackActionMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: rackActionMsg.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              color: rackActionMsg.type === 'error' ? '#ef4444' : '#10b981',
              border: `1px solid ${rackActionMsg.type === 'error' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`
            }}
          >
            {rackActionMsg.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
            <span>{rackActionMsg.text}</span>
          </div>
        )}

        {/* Filter and Search Bar for Racks */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search rack or hall (e.g. Rack 12, Hall 1)..."
              value={rackSearchQuery}
              onChange={(e) => setRackSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', height: '34px', fontSize: '13px', width: '100%' }}
            />
          </div>

          {/* Warehouse Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {['All', ...uniqueWarehouses].map(wh => (
              <button
                key={wh}
                type="button"
                onClick={() => setSelectedRackWarehouse(wh)}
                style={{
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  background: selectedRackWarehouse === wh ? 'var(--accent-color, #3b82f6)' : 'var(--bg-secondary, #f1f5f9)',
                  color: selectedRackWarehouse === wh ? '#ffffff' : 'var(--text-muted, #64748b)',
                  transition: 'all 0.15s ease'
                }}
              >
                {wh}
              </button>
            ))}
          </div>
        </div>

        {/* Racks Table */}
        <div className="custom-table-container" style={{ maxHeight: '380px', overflowY: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Warehouse / Hall</th>
                <th style={{ width: '40%' }}>Rack Code / Full Slot Label</th>
                <th style={{ width: '18%' }}>Default Capacity</th>
                <th style={{ textAlign: 'right', width: '20%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRacks.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px' }}>
                    {loadingLocations ? 'Loading warehouse racks...' : 'No warehouse racks found matching your filter. Click "+ Add New Rack" to create one.'}
                  </td>
                </tr>
              ) : (
                filteredRacks.map((loc) => {
                  const isDeleting = isDeletingRackId === (loc.id || loc.code);
                  return (
                    <tr key={loc.id || loc.code}>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.08)',
                            color: '#2563eb',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            border: '1px solid rgba(59, 130, 246, 0.2)'
                          }}
                        >
                          <MapPin size={11} style={{ display: 'inline', marginRight: '4px' }} />
                          {loc.warehouse || 'Main Store'}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{loc.code}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
                          {loc.capacity || 20} pkts
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteRack(loc)}
                          disabled={isDeleting}
                          title={`Delete rack ${loc.code}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            fontWeight: '700'
                          }}
                        >
                          <Trash2 size={13} />
                          <span>{isDeleting ? 'Deleting...' : 'Delete Rack'}</span>
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

      {/* Raw Materials Catalog Configuration */}
      <div className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="panel-title">
            <Package size={18} className="text-accent" />
            Raw Materials Inventory Database ({materials.length})
          </h3>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setIsAddingMaterial(true);
              setMatName('');
              setMatCategory('Fabric');
              setMatStock('');
              setMatUnit('meters');
              setMatCost('');
              setMatThreshold('50');
              setMatColor('');
              setMatLocation('');
              setMatError('');
            }}
          >
            <PlusCircle size={14} /> Add Raw Material
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
          View, edit details, or delete raw materials from the active inventory database. Changes will update stock valuations and BOM calculations in real-time.
        </p>

        {/* Search bar inside Settings for materials */}
        <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '350px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search raw materials catalog..."
            value={matSearchQuery}
            onChange={(e) => setMatSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', height: '34px', fontSize: '13px' }}
          />
        </div>

        <div className="custom-table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Material Name</th>
                <th>Category</th>
                <th>Stock Level</th>

                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No raw materials match your search query.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px' }}>{m.id}</td>
                    <td>
                      <strong style={{ display: 'block', fontSize: '14px' }}>{m.name}</strong>
                      {m.color && m.color !== 'Default' && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Color: {m.color}</span>
                      )}
                      {m.location && m.location !== 'Default' && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Location: {m.location}</span>
                      )}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{m.category}</td>
                    <td>
                      <span style={{
                        fontWeight: '700',
                        color: m.stock <= m.threshold ? 'var(--danger)' : 'var(--text-main)'
                      }}>
                        {m.stock} {m.unit}
                      </span>
                      {m.stock <= m.threshold && (
                        <span style={{
                          marginLeft: '6px', fontSize: '10px', fontWeight: '700',
                          backgroundColor: 'var(--danger-light)', color: 'var(--danger)',
                          padding: '2px 6px', borderRadius: '4px'
                        }}>
                          LOW STOCK
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingMaterial(m);
                            setMatName(m.name);
                            setMatCategory(m.category);
                            setMatStock(m.stock);
                            setMatUnit(m.unit);
                            setMatCost(m.cost);
                            setMatThreshold(m.threshold || 50);
                            setMatColor(m.color || '');
                            setMatLocation(m.location || '');
                            setMatError('');
                          }}
                          style={{ padding: '6px' }}
                          title="Edit material details"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete material "${m.name}"?`)) {
                              onDeleteMaterial(m.id);
                            }
                          }}
                          style={{ padding: '6px' }}
                          title="Delete material from database"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Material Details Modal */}
      {editingMaterial && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit size={20} style={{ color: 'var(--accent-color)' }} />
                <span>Edit Material Details</span>
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingMaterial(null)}
                style={{ padding: '4px 8px' }}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit}>
              {matError && (
                <div className="auth-alert error" style={{ padding: '8px 12px', marginBottom: '16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                  <span>{matError}</span>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Material Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={matName}
                    onChange={(e) => setMatName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Material Category</label>
                  <select
                    className="form-input"
                    value={matCategory}
                    onChange={(e) => setMatCategory(e.target.value)}
                  >
                    <option value="Fabric">Fabric (Cotton, Denim, Silk)</option>
                    <option value="Trim">Trim (Zippers, Buttons, Rivets)</option>
                    <option value="Accessory">Accessory (Labels, Tags, Hangers)</option>
                    <option value="Packaging">Packaging (Poly bags, Cartons)</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Stock Quantity</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={matStock}
                    onChange={(e) => setMatStock(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <select
                    className="form-input"
                    value={matUnit}
                    onChange={(e) => setMatUnit(e.target.value)}
                  >
                    <option value="meters">Meters</option>
                    <option value="yards">Yards</option>
                    <option value="rolls">Rolls</option>
                    <option value="pieces">Pieces</option>
                    <option value="kg">Kgs</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Unit Cost Price ({currencySymbol})</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={matCost}
                    onChange={(e) => setMatCost(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Critical Reorder Threshold (Min Qty)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={matThreshold}
                    onChange={(e) => setMatThreshold(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Color / Style Reference Description</label>
                  <input
                    type="text"
                    className="form-input"
                    value={matColor}
                    onChange={(e) => setMatColor(e.target.value)}
                    placeholder="e.g. Bleached Dark Blue, Matte Gold"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Location Reference Description</label>
                  <input
                    type="text"
                    className="form-input"
                    value={matLocation}
                    onChange={(e) => setMatLocation(e.target.value)}
                    placeholder="e.g. Hall 1 Rack 2, Main Store"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingMaterial(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Raw Material Modal */}
      {isAddingMaterial && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle size={20} style={{ color: 'var(--accent-color)' }} />
                <span>Add Raw Material to Catalog</span>
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsAddingMaterial(false)}
                style={{ padding: '4px 8px' }}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAddMatSubmit}>
              {matError && (
                <div className="auth-alert error" style={{ padding: '8px 12px', marginBottom: '16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                  <span>{matError}</span>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Material Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Indigo Denim Raw Roll"
                    value={matName}
                    onChange={(e) => setMatName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Material Category</label>
                  <select
                    className="form-input"
                    value={matCategory}
                    onChange={(e) => setMatCategory(e.target.value)}
                  >
                    <option value="Fabric">Fabric (Cotton, Denim, Silk)</option>
                    <option value="Trim">Trim (Zippers, Buttons, Rivets)</option>
                    <option value="Accessory">Accessory (Labels, Tags, Hangers)</option>
                    <option value="Packaging">Packaging (Poly bags, Cartons)</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Stock Quantity</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="0"
                    value={matStock}
                    onChange={(e) => setMatStock(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <select
                    className="form-input"
                    value={matUnit}
                    onChange={(e) => setMatUnit(e.target.value)}
                  >
                    <option value="meters">Meters</option>
                    <option value="yards">Yards</option>
                    <option value="rolls">Rolls</option>
                    <option value="pieces">Pieces</option>
                    <option value="kg">Kgs</option>
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Unit Cost Price ({currencySymbol})</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="e.g. 15.50"
                    value={matCost}
                    onChange={(e) => setMatCost(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Critical Reorder Threshold (Min Qty)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="50"
                    value={matThreshold}
                    onChange={(e) => setMatThreshold(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Color / Style Reference Description</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Bleached Dark Blue, Matte Gold"
                    value={matColor}
                    onChange={(e) => setMatColor(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Location Reference Description</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Hall 1 Rack 2, Main Store"
                    value={matLocation}
                    onChange={(e) => setMatLocation(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddingMaterial(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Catalog Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Warehouse Rack Modal */}
      {isAddingRack && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle size={20} style={{ color: 'var(--accent-color)' }} />
                <span>Add Warehouse Rack / Slot</span>
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsAddingRack(false)}
                style={{ padding: '4px 8px' }}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAddRackSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                  Warehouse / Hall
                </label>
                <select
                  className="form-input"
                  value={newRackWarehouse}
                  onChange={(e) => setNewRackWarehouse(e.target.value)}
                  style={{ height: '38px', fontSize: '13px' }}
                >
                  <option value="Main Store">Main Store</option>
                  <option value="Hall 1">Hall 1</option>
                  <option value="Hall 2">Hall 2</option>
                  <option value="Hall 3">Hall 3</option>
                  <option value="Hall 4">Hall 4</option>
                  <option value="Hall 5">Hall 5</option>
                  <option value="__custom__">+ Custom Warehouse / Hall...</option>
                </select>
              </div>

              {newRackWarehouse === '__custom__' && (
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                    Custom Hall / Zone Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Hall 6, Secondary Warehouse"
                    value={customRackWh}
                    onChange={(e) => setCustomRackWh(e.target.value)}
                    required
                    style={{ height: '38px', fontSize: '13px' }}
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                  Rack Name / Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Rack 15, RACK 101, Slot A"
                  value={newRackName}
                  onChange={(e) => setNewRackName(e.target.value)}
                  required
                  style={{ height: '38px', fontSize: '13px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                  Default Packet Capacity
                </label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={newRackCapacity}
                  onChange={(e) => setNewRackCapacity(e.target.value)}
                  style={{ height: '38px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddingRack(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Create Rack Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
