import React, { useState, useEffect, useMemo } from 'react';
import { Settings, ShieldAlert, Plus, PlusCircle, Trash2, Globe, Users, User, Edit, Package, Search, Warehouse, MapPin, CheckCircle, RefreshCw, AlertTriangle, Camera, Image as ImageIcon, Eye, Shield, Mail, UserCheck, ShieldCheck } from 'lucide-react';
import { getBackendUrl } from '../utils/api';

export default function SettingsView({
  currentUser,
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
  onToggleAllowMaterialPhotoEdit,
  allowWarehouseAddRack = false,
  onToggleAllowWarehouseAddRack
}) {
  // Registered Users (Signup Name & Gmail / Email) State
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const fetchRegisteredUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch(`${getBackendUrl()}/api/users`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRegisteredUsers(data);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch registered users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchRegisteredUsers();
  }, []);

  const displayUsers = useMemo(() => {
    let list = [...registeredUsers];
    if (list.length === 0 && currentUser) {
      list = [currentUser];
    }
    if (!userSearchQuery.trim()) return list;
    const q = userSearchQuery.toLowerCase().trim();
    return list.filter(u =>
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.email || '').toLowerCase().includes(q) ||
      String(u.role || '').toLowerCase().includes(q)
    );
  }, [registeredUsers, currentUser, userSearchQuery]);

  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [materialsJoined, setMaterialsJoined] = useState('Fabrics & Trims');
  const [vendorError, setVendorError] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorToDelete, setVendorToDelete] = useState(null);
  const [accToDelete, setAccToDelete] = useState(null);
  const [designerToDelete, setDesignerToDelete] = useState(null);

  // Handle Add Vendor function
  const handleAddVendor = (e) => {
    e.preventDefault();
    if (!vendorName || !vendorName.trim()) {
      setVendorError('Please provide a Supplier Company Name.');
      return;
    }
    const newVendor = {
      id: `V${Date.now().toString().slice(-4)}`,
      name: vendorName.trim(),
      email: vendorEmail.trim() || 'vendor@mohit.com',
      address: vendorAddress.trim() || 'Factory / Store Location',
      materialsJoined: (materialsJoined && materialsJoined.trim()) ? materialsJoined.trim() : 'General Accessories'
    };

    if (typeof onAddVendor === 'function') {
      onAddVendor(newVendor);
    }
    setVendorName('');
    setVendorEmail('');
    setVendorAddress('');
    setMaterialsJoined('');
    setIsAddingVendor(false);
    setVendorError('');
  };



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
  const [isEditingRack, setIsEditingRack] = useState(false);
  const [editingRack, setEditingRack] = useState(null);
  const [editRackWarehouse, setEditRackWarehouse] = useState('Main Store');
  const [editCustomRackWh, setEditCustomRackWh] = useState('');
  const [editRackName, setEditRackName] = useState('');
  const [editRackCapacity, setEditRackCapacity] = useState(20);

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

  const canonicalizeLocation = (rawStr, defaultWarehouse = 'Main Store') => {
    if (!rawStr) return '';
    let str = String(rawStr).trim();
    if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return '';

    str = str.replace(/\(\d+\s*pkts?\)/gi, '').trim();

    let warehouse = defaultWarehouse || 'Main Store';
    if (/^([a-z0-9\s]+?)\s*[-–]\s*/i.test(str)) {
      const parts = str.split(/[-–]/);
      const potentialWh = parts[0].trim();
      if (potentialWh) {
        warehouse = potentialWh;
      }
    }

    let remainder = str;
    let prev = '';
    while (prev !== remainder) {
      prev = remainder;
      remainder = remainder
        .replace(new RegExp(`^${warehouse}\\s*[-–]?\\s*`, 'i'), '')
        .replace(/^rack\s*[-–]?\s*/i, '')
        .replace(new RegExp(`^${warehouse}\\s*[-–]?\\s*`, 'i'), '')
        .replace(/^rack\s*[-–]?\s*/i, '')
        .trim();
    }

    let rackPart = remainder || '1';
    if (/^\d+$/i.test(rackPart)) {
      rackPart = `RACK ${rackPart}`;
    } else if (!rackPart.toLowerCase().startsWith('rack') && !rackPart.toLowerCase().startsWith('hall') && !rackPart.toLowerCase().startsWith('shelf') && !rackPart.toLowerCase().startsWith('bin')) {
      rackPart = `RACK ${rackPart}`;
    }

    return `${warehouse} - ${rackPart}`;
  };

  // Compute all available locations combining DB & state
  const allLocationsList = useMemo(() => {
    const map = new Map();
    (dbLocations || []).forEach(loc => {
      const clean = canonicalizeLocation(loc.code || loc.id, loc.warehouse);
      if (!clean) return;
      const wh = clean.includes(' - ') ? clean.split(' - ')[0].trim() : (loc.warehouse || 'Main Store');
      const key = clean.toUpperCase();
      const cap = Number(loc.capacity) || 20;
      map.set(key, { id: loc.id || key.toLowerCase().replace(/\s+/g, '-'), code: clean, warehouse: wh, capacity: cap, source: 'db' });
    });
    (racks || []).forEach(r => {
      const clean = canonicalizeLocation(r.code || r.name, r.warehouse);
      if (!clean) return;
      const wh = clean.includes(' - ') ? clean.split(' - ')[0].trim() : (r.warehouse || 'Main Store');
      const key = clean.toUpperCase();
      if (!map.has(key)) {
        map.set(key, { id: r.id || key.toLowerCase().replace(/\s+/g, '-'), code: clean, warehouse: wh, capacity: Number(r.capacity) || 20, source: 'racks' });
      }
    });
    const list = Array.from(map.values());
    list.sort((a, b) => {
      const whComp = String(a.warehouse || '').localeCompare(String(b.warehouse || ''), undefined, { numeric: true, sensitivity: 'base' });
      if (whComp !== 0) return whComp;
      return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' });
    });
    return list;
  }, [dbLocations, racks]);

  const uniqueWarehouses = useMemo(() => {
    const s = new Set();
    allLocationsList.forEach(l => {
      const w = (l.warehouse || '').trim();
      if (w) s.add(w);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [allLocationsList]);

  useEffect(() => {
    if (selectedRackWarehouse !== 'All' && !uniqueWarehouses.includes(selectedRackWarehouse)) {
      setSelectedRackWarehouse('All');
    }
  }, [uniqueWarehouses, selectedRackWarehouse]);

  const filteredRacks = useMemo(() => {
    return allLocationsList.filter(loc => {
      const q = rackSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || loc.code.toLowerCase().includes(q) || loc.warehouse.toLowerCase().includes(q);
      const matchesWh = selectedRackWarehouse === 'All' || loc.warehouse === selectedRackWarehouse;
      return matchesSearch && matchesWh;
    });
  }, [allLocationsList, rackSearchQuery, selectedRackWarehouse]);

  // Handle Start Edit Rack
  const handleStartEditRack = (loc) => {
    setEditingRack(loc);
    const wh = loc.warehouse || 'Main Store';
    if (uniqueWarehouses.includes(wh)) {
      setEditRackWarehouse(wh);
      setEditCustomRackWh('');
    } else {
      setEditRackWarehouse('__custom__');
      setEditCustomRackWh(wh);
    }

    let raw = loc.code || '';
    if (raw.toLowerCase().startsWith(wh.toLowerCase() + ' - ')) {
      raw = raw.substring(wh.length + 3);
    }
    setEditRackName(raw);
    setEditRackCapacity(loc.capacity || 20);
    setIsEditingRack(true);
  };

  // Handle Edit Rack Submit
  const handleEditRackSubmit = async (e) => {
    e.preventDefault();
    if (!editingRack) return;
    const finalWh = editRackWarehouse === '__custom__' ? (editCustomRackWh.trim() || 'Main Store') : editRackWarehouse;
    const raw = editRackName.trim();
    if (!raw) return;
    const fullCode = raw.toLowerCase().includes(finalWh.toLowerCase()) ? raw : `${finalWh} - ${raw.replace(/^rack\s*/i, 'RACK ')}`;
    const identifier = editingRack.id || editingRack.code;

    try {
      const res = await fetch(`${getBackendUrl()}/api/warehouse-locations/${encodeURIComponent(identifier)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse: finalWh,
          code: fullCode,
          capacity: Number(editRackCapacity) || 20
        })
      });

      if (res.ok) {
        await fetchLiveLocations();
        if (setRacks) {
          setRacks(prev => prev.map(r => {
            if (r.id === identifier || r.code === identifier || `${r.warehouse} - ${r.code}` === identifier || `${r.warehouse} - ${r.name}` === identifier) {
              return {
                ...r,
                warehouse: finalWh,
                code: fullCode,
                name: fullCode,
                capacity: Number(editRackCapacity) || 20
              };
            }
            return r;
          }));
        }
        setIsEditingRack(false);
        setEditingRack(null);
        setRackActionMsg({ type: 'success', text: `Rack "${fullCode}" updated successfully.` });
      } else {
        const errData = await res.json().catch(() => ({}));
        setRackActionMsg({ type: 'error', text: errData.error || 'Failed to update rack.' });
      }
    } catch (err) {
      setRackActionMsg({ type: 'error', text: 'Error: ' + err.message });
    } finally {
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

  // Raw Materials Catalog Management States
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [matSearchQuery, setMatSearchQuery] = useState('');
  const [matItemCode, setMatItemCode] = useState('');
  const [matName, setMatName] = useState('');
  const [matCategory, setMatCategory] = useState('FABRICS');
  const [matStock, setMatStock] = useState('');
  const [matUnit, setMatUnit] = useState('Pcs');
  const [matCost, setMatCost] = useState('');
  const [matThreshold, setMatThreshold] = useState('50');
  const [matColor, setMatColor] = useState('');
  const [matLocation, setMatLocation] = useState('');
  const [matError, setMatError] = useState('');

  const categorySuggestions = useMemo(() => {
    const set = new Set();
    (materials || []).forEach(m => {
      if (m.category && m.category.trim()) set.add(m.category.trim().toUpperCase());
    });
    [
      'ZIPPERS', 'BUTTONS', 'ELASTICS', 'TRIMS', 'FABRICS', 'ACCESSORIES',
      'LABELS', 'PACKAGING', 'THREADS', 'CORDS', 'BUCKLES', 'RIVETS', 'TAPES', 'HOOKS',
      'FABRIC', 'TRIM', 'ACCESSORY'
    ].forEach(p => set.add(p));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [materials]);

  // Handle Edit Material Update Submit
  const handleUpdateSubmit = (e) => {
    e.preventDefault();
    if (!matName.trim()) {
      setMatError('Material Name is required.');
      return;
    }
    const updated = {
      ...editingMaterial,
      itemCode: matItemCode ? matItemCode.trim() : (editingMaterial.itemCode || editingMaterial.id),
      name: matName.trim(),
      category: matCategory ? matCategory.trim() : 'FABRICS',
      stock: parseFloat(matStock) || 0,
      unit: matUnit ? matUnit.trim() : 'Pcs',
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
      itemCode: matItemCode ? matItemCode.trim() : newId,
      name: matName.trim(),
      category: matCategory ? matCategory.trim() : 'FABRICS',
      stock: parseFloat(matStock) || 0,
      unit: matUnit ? matUnit.trim() : 'Pcs',
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
    setMatItemCode('');
    setMatName('');
    setMatCategory('FABRICS');
    setMatStock('');
    setMatUnit('Pcs');
    setMatCost('');
    setMatThreshold('50');
    setMatColor('');
    setMatLocation('');
    setMatError('');
  };

  // Filter materials: only show present materials (stock > 0)
  const filteredMaterials = (materials || []).filter(m => {
    if (Number(m.stock) <= 0) return false;
    const q = matSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.id || '').toLowerCase().includes(q) ||
      (m.itemCode || '').toLowerCase().includes(q) ||
      (m.item_code || '').toLowerCase().includes(q) ||
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

      {/* ── 1. ACTIVE LOGGED-IN USER PROFILE & GMAIL CARD ── */}
      <div style={{
        marginBottom: '24px',
        padding: '20px 24px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        border: '1.5px solid rgba(255, 255, 255, 0.12)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '58px',
            height: '58px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: '900',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.45)',
            border: '2.5px solid rgba(255, 255, 255, 0.3)',
            flexShrink: 0
          }}>
            {String(currentUser?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#93c5fd' }}>
                LOGGED-IN ACCOUNT PROFILE
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <CheckCircle size={11} /> Verified User
              </span>
            </div>
            <h3 style={{ margin: '4px 0 2px 0', fontSize: '22px', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.02em' }}>
              {currentUser?.name || 'Store User'}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', marginTop: '6px', fontSize: '13.5px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(255, 255, 255, 0.08)', padding: '3px 10px', borderRadius: '6px' }}>
                <Mail size={15} style={{ color: '#f87171' }} />
                <span style={{ color: '#cbd5e1', fontSize: '12px' }}>Gmail / Email:</span>
                <strong style={{ color: '#ffffff', fontFamily: 'monospace' }}>{currentUser?.email || 'N/A'}</strong>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={14} style={{ color: '#a78bfa' }} />
                <span style={{ color: '#cbd5e1', fontSize: '12px' }}>System Role:</span>
                <span style={{
                  padding: '1px 8px',
                  borderRadius: '4px',
                  fontSize: '11.5px',
                  fontWeight: '800',
                  background: currentUser?.role === 'Admin' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)',
                  color: currentUser?.role === 'Admin' ? '#fca5a5' : '#93c5fd'
                }}>
                  {currentUser?.role || 'Admin'}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.07)',
            padding: '10px 18px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            textAlign: 'right'
          }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security Session</div>
            <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: '800', marginTop: '2px' }}>12-Hour Active Session</div>
          </div>
        </div>
      </div>

      {/* ── 2. REGISTERED USERS DIRECTORY (SIGNUP NAME & GMAIL DIRECTORY) ── */}
      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} className="text-accent" />
            <div>
              <h3 className="panel-title" style={{ margin: 0, fontSize: '15px' }}>
                Registered Accounts Directory ({displayUsers.length})
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                System user signup names, registered Gmail / email addresses, and account permissions.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search name or gmail..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                style={{ padding: '7px 10px 7px 30px', fontSize: '12.5px', height: '34px' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchRegisteredUsers}
              disabled={loadingUsers}
              title="Refresh users list"
              style={{ height: '34px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <RefreshCw size={13} className={loadingUsers ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {displayUsers.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <User size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <div style={{ fontSize: '14px', fontWeight: '700' }}>No users found matching your search.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: '800' }}>
                  <th style={{ padding: '10px 14px' }}># ID</th>
                  <th style={{ padding: '10px 14px' }}>SIGNUP NAME</th>
                  <th style={{ padding: '10px 14px' }}>GMAIL / EMAIL</th>
                  <th style={{ padding: '10px 14px' }}>ROLE</th>
                  <th style={{ padding: '10px 14px' }}>ACCOUNT STATUS</th>
                  <th style={{ padding: '10px 14px' }}>REGISTRATION DATE</th>
                </tr>
              </thead>
              <tbody>
                {displayUsers.map((u, index) => {
                  const isCurrent = currentUser && (u.email === currentUser.email || u.id === currentUser.id);
                  return (
                    <tr key={u.id || u.email || index} style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: isCurrent ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                    }}>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontWeight: '700' }}>
                        #{u.id || index + 1}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: isCurrent ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#475569',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13.5px',
                            fontWeight: '800',
                            flexShrink: 0,
                            boxShadow: isCurrent ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none'
                          }}>
                            {String(u.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {u.name || 'Anonymous User'}
                              {isCurrent && (
                                <span style={{
                                  fontSize: '10.5px',
                                  fontWeight: '800',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: '#dbeafe',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe'
                                }}>
                                  You (Active)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: 'var(--text-main)', fontWeight: '700' }}>
                          <Mail size={15} style={{ color: '#ef4444' }} />
                          <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-main)' }}>{u.email}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          background: u.role === 'Admin' ? 'rgba(239, 68, 68, 0.1)' : u.role === 'Designer' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                          color: u.role === 'Admin' ? '#dc2626' : u.role === 'Designer' ? '#7e22ce' : '#2563eb',
                          border: `1px solid ${u.role === 'Admin' ? 'rgba(239, 68, 68, 0.25)' : u.role === 'Designer' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`
                        }}>
                          {u.role || 'User'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          color: '#059669',
                          background: 'rgba(16, 185, 129, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(16, 185, 129, 0.25)'
                        }}>
                          <CheckCircle size={12} /> Active &bull; Verified
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '12px' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Active Account'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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

          {/* Warehouse Add Rack & Hall Permission Control (Admin Exclusive) */}
          <div className="panel" style={{
            marginBottom: 0,
            border: allowWarehouseAddRack ? '1.5px solid rgba(16, 185, 129, 0.35)' : '1.5px solid rgba(99, 102, 241, 0.35)',
            background: allowWarehouseAddRack ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, var(--bg-primary) 100%)' : 'linear-gradient(180deg, rgba(99, 102, 241, 0.03) 0%, var(--bg-primary) 100%)'
          }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Warehouse size={18} className="text-accent" />
                Warehouse Add Rack & Hall Permission
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
              Control whether operators and users can add new racks and halls in <strong>Warehouse Locations Matrix</strong>. Turn OFF to restrict to normal view-only panel.
            </p>

            <div
              onClick={() => {
                if (onToggleAllowWarehouseAddRack) {
                  onToggleAllowWarehouseAddRack(!allowWarehouseAddRack);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                backgroundColor: allowWarehouseAddRack ? 'rgba(16, 185, 129, 0.07)' : 'rgba(100, 116, 139, 0.06)',
                border: allowWarehouseAddRack ? '1.5px solid rgba(16, 185, 129, 0.35)' : '1.5px solid rgba(100, 116, 139, 0.22)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                userSelect: 'none',
                boxShadow: allowWarehouseAddRack ? '0 4px 16px rgba(16, 185, 129, 0.08)' : '0 2px 8px rgba(0,0,0,0.03)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.borderColor = allowWarehouseAddRack ? '#10b981' : '#64748b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = allowWarehouseAddRack ? 'rgba(16, 185, 129, 0.35)' : 'rgba(100, 116, 139, 0.22)';
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
                  background: allowWarehouseAddRack
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                  color: '#ffffff',
                  boxShadow: allowWarehouseAddRack
                    ? '0 4px 12px rgba(16, 185, 129, 0.35)'
                    : '0 3px 8px rgba(100, 116, 139, 0.25)',
                  transition: 'all 0.3s ease'
                }}>
                  {allowWarehouseAddRack ? <Plus size={22} /> : <Eye size={22} />}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '800',
                      color: allowWarehouseAddRack ? '#065f46' : 'var(--text-main)'
                    }}>
                      {allowWarehouseAddRack ? 'Add Rack & Hall: ACTIVE' : 'Normal View Panel: ACTIVE'}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      padding: '2px 7px',
                      borderRadius: '9999px',
                      backgroundColor: allowWarehouseAddRack ? '#dcfce7' : '#e2e8f0',
                      color: allowWarehouseAddRack ? '#15803d' : '#475569',
                      border: allowWarehouseAddRack ? '1px solid #86efac' : '1px solid #cbd5e1',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: allowWarehouseAddRack ? '#16a34a' : '#94a3b8',
                        boxShadow: allowWarehouseAddRack ? '0 0 6px #16a34a' : 'none'
                      }} />
                      {allowWarehouseAddRack ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {allowWarehouseAddRack
                      ? 'Users and admins can add new warehouse racks and halls directly.'
                      : 'Add buttons are hidden. Normal operators view the clean warehouse matrix.'}
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
                  background: allowWarehouseAddRack
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                  boxShadow: allowWarehouseAddRack
                    ? '0 4px 14px rgba(16, 185, 129, 0.4), inset 0 1px 2px rgba(255,255,255,0.3)'
                    : 'inset 0 2px 4px rgba(0,0,0,0.15)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '3px',
                  boxSizing: 'border-box',
                  flexShrink: 0
                }}
                title={allowWarehouseAddRack ? 'Click to switch OFF (Normal View Panel)' : 'Click to switch ON (Allow Adding Racks/Halls)'}
              >
                {/* Track Text Indicator */}
                <span style={{
                  position: 'absolute',
                  left: '10px',
                  fontSize: '10px',
                  fontWeight: '900',
                  letterSpacing: '0.05em',
                  color: '#ffffff',
                  opacity: allowWarehouseAddRack ? 1 : 0,
                  transform: allowWarehouseAddRack ? 'scale(1)' : 'scale(0.7)',
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
                  opacity: !allowWarehouseAddRack ? 1 : 0,
                  transform: !allowWarehouseAddRack ? 'scale(1)' : 'scale(0.7)',
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
                    transform: `translateX(${allowWarehouseAddRack ? '34px' : '2px'})`,
                    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: allowWarehouseAddRack ? '#10b981' : '#64748b'
                  }}
                >
                  {allowWarehouseAddRack ? (
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
                        onClick={() => setAccToDelete(acc)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={`Remove ${acc}`}
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
                        onClick={() => setDesignerToDelete(designerName)}
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
        {(() => {
          const safeVendors = Array.isArray(vendors) ? vendors : [];
          const filteredVendors = safeVendors.filter(v => {
            if (!vendorSearch.trim()) return true;
            const q = vendorSearch.toLowerCase();
            return (
              String(v.name || '').toLowerCase().includes(q) ||
              String(v.email || '').toLowerCase().includes(q) ||
              String(v.address || '').toLowerCase().includes(q) ||
              String(v.materialsJoined || '').toLowerCase().includes(q)
            );
          });

          return (
            <div className="panel" style={{ marginBottom: 0 }}>
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} className="text-accent" />
                  Associated Suppliers & Vendors ({safeVendors.length})
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ position: 'relative', width: '180px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search vendors..."
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      style={{ padding: '6px 10px 6px 28px', fontSize: '12px', height: '32px' }}
                    />
                    <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  </div>
                  {!isAddingVendor && (
                    <button className="btn btn-primary btn-sm" onClick={() => { setIsAddingVendor(true); setVendorError(''); setMaterialsJoined(''); }} style={{ height: '32px' }}>
                      <PlusCircle size={14} /> Add Vendor
                    </button>
                  )}
                </div>
              </div>

              {isAddingVendor && (
                <form onSubmit={handleAddVendor} className="animate-scale" style={{ marginBottom: '20px', padding: '16px', border: '1.5px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-primary)' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '12px', color: 'var(--text-main)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PlusCircle size={15} color="var(--primary-color)" />
                    <span>New Supplier / Vendor Information</span>
                  </h4>
                  {vendorError && (
                    <div className="auth-alert error" style={{ padding: '8px 12px', marginBottom: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                      <span>{vendorError}</span>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', fontWeight: '700' }}>Company Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. YKK Trim Solutions"
                        value={vendorName}
                        onChange={(e) => setVendorName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', fontWeight: '700' }}>Contact Email</label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="e.g. sales@vendor.com"
                        value={vendorEmail}
                        onChange={(e) => setVendorEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', fontWeight: '700' }}>Office / Factory Location</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Industrial Area Phase 1"
                        value={vendorAddress}
                        onChange={(e) => setVendorAddress(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', fontWeight: '700' }}>
                        Materials Supplied <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(type custom or select)</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Elastic, Dori, Custom Trims (type manually)"
                        value={materialsJoined}
                        onChange={(e) => setMaterialsJoined(e.target.value)}
                        list="vendor-materials-datalist"
                        autoComplete="off"
                        required
                      />
                      <datalist id="vendor-materials-datalist">
                        <option value="Fabrics & Yarn" />
                        <option value="Buttons, Zippers & Trims" />
                        <option value="Labels, Tags & Hangers" />
                        <option value="Elastic, Dori & Tape" />
                        <option value="Full Apparel Accessories" />
                        <option value="Threads, Cords & Ropes" />
                        <option value="Interlining & Fusing" />
                        <option value="Poly Bags & Packaging" />
                        <option value="Metal Rivets & Eyelets" />
                        <option value="Bones & Plastic Stiffeners" />
                      </datalist>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAddingVendor(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm">Save Vendor</button>
                  </div>
                </form>
              )}

              <div className="custom-table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>Vendor ID</th>
                      <th style={{ padding: '10px 12px' }}>Supplier / Company</th>
                      <th style={{ padding: '10px 12px' }}>Materials Supplied</th>
                      <th style={{ padding: '10px 12px' }}>Location</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVendors.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {safeVendors.length === 0 ? 'No vendors added yet. Click "+ Add Vendor" to create one.' : 'No vendors matching your search.'}
                        </td>
                      </tr>
                    ) : (
                      filteredVendors.map((v) => (
                        <tr key={v.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '800', color: 'var(--primary-color)' }}>
                            {v.id}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <strong style={{ display: 'block', fontSize: '13.5px', color: 'var(--text-main)' }}>{v.name}</strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.email || '—'}</span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className="status-badge" style={{ backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px' }}>
                              {v.materialsJoined || 'General Accessories'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            {v.address || '—'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => setVendorToDelete(v)}
                              title="Delete Vendor"
                              style={{ padding: '5px 8px' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
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
                setNewRackWarehouse(uniqueWarehouses[0] || 'Main Store');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <PlusCircle size={14} /> Add New Rack
            </button>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '14px' }}>
          Configure, search, add, or <strong>edit warehouse racks & storage slots</strong>. Updates will sync in real-time across Inward Weight Capture, Manual Entry, and Material Transfer dropdowns.
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
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleStartEditRack(loc)}
                          title={`Edit rack ${loc.code}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            borderColor: 'var(--accent-color, #3b82f6)',
                            color: 'var(--accent-color, #3b82f6)'
                          }}
                        >
                          <Edit size={13} />
                          <span>Edit Rack</span>
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
            Raw Materials Inventory Database ({filteredMaterials.length})
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
          Real-time catalog of all active raw materials with available inventory (materials present in stock). Zero-stock or depleted records are automatically excluded.
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
                <th style={{ width: '85px', minWidth: '80px' }}>ID</th>
                <th style={{ width: '130px', minWidth: '110px' }}>Item Code</th>
                <th>Material Name</th>
                <th>Category</th>
                <th>Stock Level</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No raw materials match your search query.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px' }}>{m.id}</td>
                    <td>
                      <span className="badge" style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        color: '#2563eb',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        fontFamily: 'monospace',
                        fontWeight: '800',
                        fontSize: '12px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {m.itemCode || m.item_code || m.id}
                      </span>
                    </td>
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
                            setMatItemCode(m.itemCode || m.item_code || m.id || '');
                            setMatName(m.name || '');
                            setMatCategory(m.category || 'FABRICS');
                            setMatStock(m.stock !== undefined ? m.stock : '');
                            setMatUnit(m.unit || 'Pcs');
                            setMatCost(m.cost !== undefined ? m.cost : 0);
                            setMatThreshold(m.threshold !== undefined ? m.threshold : 50);
                            setMatColor(m.color || '');
                            setMatLocation(m.location || '');
                            setMatError('');
                          }}
                          style={{ padding: '6px' }}
                          title="Edit material details"
                        >
                          <Edit size={14} />
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
                  <label className="form-label">Item Code (Master Code)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={matItemCode}
                    onChange={(e) => setMatItemCode(e.target.value)}
                    placeholder="e.g. ST00001"
                    style={{ fontFamily: 'monospace', fontWeight: '700' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Material Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={matName}
                    onChange={(e) => setMatName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Material Category <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={matCategory}
                    onChange={(e) => setMatCategory(e.target.value)}
                    list="settings-category-suggestions"
                    placeholder="e.g. ZIPPERS / TRIMS (type or select)"
                    autoComplete="on"
                    style={{ fontWeight: '600' }}
                    required
                  />
                  <datalist id="settings-category-suggestions">
                    {categorySuggestions.map((cat, idx) => (
                      <option key={idx} value={cat} />
                    ))}
                  </datalist>
                </div>

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
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <input
                    type="text"
                    className="form-input"
                    value={matUnit}
                    onChange={(e) => setMatUnit(e.target.value)}
                    list="settings-unit-suggestions"
                    placeholder="e.g. Pcs, Mtr, Kg (type or select)"
                    autoComplete="on"
                  />
                  <datalist id="settings-unit-suggestions">
                    {['Pcs', 'Mtr', 'Kg', 'Gm', 'Pair', 'Cone', 'Roll', 'Set', 'Doz', 'Box', 'Pkt', 'Bundle', 'Yds', 'Cm', 'Inch', 'meters', 'yards', 'rolls', 'pieces', 'kg'].map((u, idx) => (
                      <option key={idx} value={u} />
                    ))}
                  </datalist>
                </div>

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
              </div>

              <div className="form-grid">
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
              </div>

              <div className="form-grid">
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
                  <label className="form-label">Item Code (Master Code)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ST00001 (or auto-generated)"
                    value={matItemCode}
                    onChange={(e) => setMatItemCode(e.target.value)}
                    style={{ fontFamily: 'monospace', fontWeight: '700' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Material Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Indigo Denim Raw Roll"
                    value={matName}
                    onChange={(e) => setMatName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Material Category <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ZIPPERS / TRIMS (type or select)"
                    value={matCategory}
                    onChange={(e) => setMatCategory(e.target.value)}
                    list="settings-category-suggestions"
                    autoComplete="on"
                    style={{ fontWeight: '600' }}
                    required
                  />
                  <datalist id="settings-category-suggestions">
                    {categorySuggestions.map((cat, idx) => (
                      <option key={idx} value={cat} />
                    ))}
                  </datalist>
                </div>

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
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Pcs, Mtr, Kg (type or select)"
                    value={matUnit}
                    onChange={(e) => setMatUnit(e.target.value)}
                    list="settings-unit-suggestions"
                    autoComplete="on"
                  />
                  <datalist id="settings-unit-suggestions">
                    {['Pcs', 'Mtr', 'Kg', 'Gm', 'Pair', 'Cone', 'Roll', 'Set', 'Doz', 'Box', 'Pkt', 'Bundle', 'Yds', 'Cm', 'Inch', 'meters', 'yards', 'rolls', 'pieces', 'kg'].map((u, idx) => (
                      <option key={idx} value={u} />
                    ))}
                  </datalist>
                </div>

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
              </div>

              <div className="form-grid">
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
              </div>

              <div className="form-grid">
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
                  Add Material
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
                  {uniqueWarehouses.map(wh => (
                    <option key={wh} value={wh}>{wh}</option>
                  ))}
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

      {/* Edit Warehouse Rack Modal */}
      {isEditingRack && editingRack && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit size={20} style={{ color: 'var(--accent-color)' }} />
                <span>Edit Warehouse Rack / Slot</span>
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setIsEditingRack(false);
                  setEditingRack(null);
                }}
                style={{ padding: '4px 8px' }}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleEditRackSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                  Warehouse / Hall
                </label>
                <select
                  className="form-input"
                  value={editRackWarehouse}
                  onChange={(e) => setEditRackWarehouse(e.target.value)}
                  style={{ height: '38px', fontSize: '13px' }}
                >
                  {uniqueWarehouses.map(wh => (
                    <option key={wh} value={wh}>{wh}</option>
                  ))}
                  <option value="__custom__">+ Custom Warehouse / Hall...</option>
                </select>
              </div>

              {editRackWarehouse === '__custom__' && (
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                    Custom Hall / Zone Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Hall 6, Secondary Warehouse"
                    value={editCustomRackWh}
                    onChange={(e) => setEditCustomRackWh(e.target.value)}
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
                  placeholder="e.g. RACK 1, Slot A"
                  value={editRackName}
                  onChange={(e) => setEditRackName(e.target.value)}
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
                  value={editRackCapacity}
                  onChange={(e) => setEditRackCapacity(e.target.value)}
                  style={{ height: '38px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsEditingRack(false);
                    setEditingRack(null);
                  }}
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

      {/* Confirm Delete Vendor Modal */}
      {vendorToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '460px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--danger, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertTriangle size={26} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>
                  Confirm Delete Vendor?
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Please take a moment to think before deleting.
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-secondary, #f8fafc)',
              border: '1.5px solid var(--border-color)',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '16px',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Vendor ID:</span>
                <strong style={{ color: 'var(--primary-color)' }}>{vendorToDelete.id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Company Name:</span>
                <strong style={{ color: 'var(--danger)' }}>{vendorToDelete.name}</strong>
              </div>
              {vendorToDelete.email && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Email:</span>
                  <span>{vendorToDelete.email}</span>
                </div>
              )}
              {vendorToDelete.materialsJoined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Materials:</span>
                  <span>{vendorToDelete.materialsJoined}</span>
                </div>
              )}
              {vendorToDelete.address && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Location:</span>
                  <span>{vendorToDelete.address}</span>
                </div>
              )}
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '22px', lineHeight: '1.45' }}>
              ⚠️ Are you sure you want to permanently delete <strong>{vendorToDelete.name}</strong> from the database? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setVendorToDelete(null)}
                style={{ padding: '9px 18px', fontSize: '13px', fontWeight: '600' }}
              >
                Cancel / Keep Vendor
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (typeof onDeleteVendor === 'function') {
                    onDeleteVendor(vendorToDelete.id);
                  }
                  setVendorToDelete(null);
                }}
                style={{ padding: '9px 18px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={14} />
                <span>Yes, Delete Vendor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Accessory Modal */}
      {accToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '420px', padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--danger, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>Remove Accessory?</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Confirm before deleting from catalog.
                </p>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '20px' }}>
              Are you sure you want to remove <strong>"{accToDelete}"</strong> from the Garment Accessories checklist?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAccToDelete(null)}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (typeof onDeleteAccessory === 'function') {
                    onDeleteAccessory(accToDelete);
                  }
                  setAccToDelete(null);
                }}
                style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Designer Modal */}
      {designerToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '420px', padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--danger, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>Remove Designer?</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Confirm before deleting from directory.
                </p>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '20px' }}>
              Are you sure you want to remove designer <strong>"{designerToDelete}"</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDesignerToDelete(null)}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (typeof onDeleteDesigner === 'function') {
                    onDeleteDesigner(designerToDelete);
                  }
                  setDesignerToDelete(null);
                }}
                style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
