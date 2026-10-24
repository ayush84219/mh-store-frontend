import React, { useState, useEffect, useMemo } from 'react';
import { Settings, ShieldAlert, Plus, PlusCircle, Trash2, Globe, Users, User, Edit, Package, Search, Warehouse, MapPin, CheckCircle, RefreshCw, AlertTriangle, Camera, Image as ImageIcon, Eye, Shield, Mail, UserCheck, ShieldCheck, Layers, DollarSign, Check, ArrowRight, TrendingUp, TrendingDown, Clock, Info, X, ChevronRight, History } from 'lucide-react';
import { getBackendUrl } from '../utils/api';

// Helper to derive pure ST ID (suppressing internal MT/M codes)
export const getSTCode = (m) => {
  if (!m) return '';
  const rawCode = String(m.itemCode || m.item_code || m.stCode || '').trim();
  if (rawCode && rawCode.toUpperCase().startsWith('ST')) {
    return rawCode.toUpperCase();
  }
  if (rawCode && rawCode.toUpperCase().startsWith('MT')) {
    return rawCode.toUpperCase().replace(/^MT/, 'ST');
  }
  if (rawCode && /^M\d+/i.test(rawCode)) {
    const digits = rawCode.replace(/\D/g, '');
    return `ST${digits.padStart(5, '0')}`;
  }
  if (rawCode && !rawCode.toUpperCase().startsWith('M')) return rawCode;

  const rawId = String(m.id || '').trim();
  if (rawId.toUpperCase().startsWith('ST')) return rawId.toUpperCase();
  if (rawId.toUpperCase().startsWith('MT')) return rawId.toUpperCase().replace(/^MT/, 'ST');
  if (/^M\d+/i.test(rawId)) {
    const digits = rawId.replace(/\D/g, '');
    return `ST${digits.padStart(5, '0')}`;
  }
  return rawId ? (rawId.replace(/\D/g, '') ? `ST${rawId.replace(/\D/g, '').padStart(5, '0')}` : `ST-${rawId}`) : '—';
};

export default function SettingsView({
  currentUser,
  vendors,
  pos = [],
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
  const [matPoNumber, setMatPoNumber] = useState('');
  const [matVendorName, setMatVendorName] = useState('');
  const [matError, setMatError] = useState('');

  // Material Pricing & Valuation Policy (FCFS / FIFO vs Update Both)
  const [materialPricingPolicy, setMaterialPricingPolicy] = useState('fcfs');
  const [savingPricingPolicy, setSavingPricingPolicy] = useState(false);
  const [revaluingStock, setRevaluingStock] = useState(false);
  const [pricingPolicyMsg, setPricingPolicyMsg] = useState(null);
  const [matUpdatePolicy, setMatUpdatePolicy] = useState('fcfs');

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/settings/material-pricing-policy`)
      .then(r => r.json())
      .then(d => {
        if (d && d.policy) setMaterialPricingPolicy(d.policy);
      })
      .catch(() => {});
  }, []);

  const handleSavePricingPolicy = async (newPolicy) => {
    setSavingPricingPolicy(true);
    setPricingPolicyMsg(null);
    try {
      const res = await fetch(`${getBackendUrl()}/api/settings/material-pricing-policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: newPolicy })
      });
      const data = await res.json();
      if (res.ok) {
        setMaterialPricingPolicy(newPolicy);
        fetchPriceUpdates();
        setPricingPolicyMsg({
          type: 'success',
          text: newPolicy === 'fcfs'
            ? '✓ FCFS / FIFO Policy Active: Old stock retains purchase price; new price applies after old stock is finished.'
            : '✓ Global Update Policy Active: Material rate updates will revalue both existing and new stock.'
        });
      } else {
        setPricingPolicyMsg({ type: 'error', text: data.error || 'Failed to update pricing policy' });
      }
    } catch (err) {
      setPricingPolicyMsg({ type: 'error', text: err.message || 'Network error updating pricing policy' });
    } finally {
      setSavingPricingPolicy(false);
      setTimeout(() => setPricingPolicyMsg(null), 7000);
    }
  };

  const handleRevalueAllStock = async () => {
    if (!window.confirm('Are you sure you want to revalue all existing inventory batches and materials to their latest registered item code rates? This will synchronize all historical batches to current prices.')) return;
    setRevaluingStock(true);
    setPricingPolicyMsg(null);
    try {
      const res = await fetch(`${getBackendUrl()}/api/materials/revalue-all-to-latest`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        fetchPriceUpdates();
        setPricingPolicyMsg({
          type: 'success',
          text: `✓ Inventory Revalued: ${data.materialsUpdated || 0} materials & ${data.batchesUpdated || 0} batches updated to latest rates.`
        });
      } else {
        setPricingPolicyMsg({ type: 'error', text: data.error || 'Failed to revalue inventory' });
      }
    } catch (err) {
      setPricingPolicyMsg({ type: 'error', text: err.message || 'Network error during inventory revaluation' });
    } finally {
      setRevaluingStock(false);
      setTimeout(() => setPricingPolicyMsg(null), 8000);
    }
  };

  // ── Updated Material Prices (Only show if price is updated) ───────────────
  const [updatedPriceMaterials, setUpdatedPriceMaterials] = useState([]);
  const [loadingPriceUpdates, setLoadingPriceUpdates] = useState(false);
  const [priceUpdatesError, setPriceUpdatesError] = useState(null);
  const [priceSearchQuery, setPriceSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState('all'); // 'all' | 'increased' | 'decreased'
  const [selectedBatchMaterial, setSelectedBatchMaterial] = useState(null);

  const fetchPriceUpdates = async () => {
    setLoadingPriceUpdates(true);
    setPriceUpdatesError(null);
    try {
      const res = await fetch(`${getBackendUrl()}/api/materials/price-updates`);
      const data = await res.json();
      if (res.ok && data.success) {
        setUpdatedPriceMaterials(data.materials || []);
      } else {
        setPriceUpdatesError(data.error || 'Failed to fetch updated material prices');
      }
    } catch (err) {
      setPriceUpdatesError(err.message || 'Network error fetching updated prices');
    } finally {
      setLoadingPriceUpdates(false);
    }
  };

  useEffect(() => {
    fetchPriceUpdates();
  }, []);

  const filteredUpdatedMaterials = useMemo(() => {
    let list = updatedPriceMaterials || [];
    if (priceFilter === 'increased') {
      list = list.filter(m => (m.priceDiff || 0) > 0);
    } else if (priceFilter === 'decreased') {
      list = list.filter(m => (m.priceDiff || 0) < 0);
    }
    if (!priceSearchQuery.trim()) return list;
    const q = priceSearchQuery.toLowerCase().trim();
    return list.filter(m =>
      String(m.materialName || '').toLowerCase().includes(q) ||
      String(m.itemCode || '').toLowerCase().includes(q) ||
      String(m.materialId || '').toLowerCase().includes(q)
    );
  }, [updatedPriceMaterials, priceFilter, priceSearchQuery]);

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

  const poSuggestions = useMemo(() => {
    const set = new Set();
    (pos || []).forEach(p => {
      const num = p.poNumber || p.id;
      if (num && String(num).trim()) set.add(String(num).trim());
    });
    (materials || []).forEach(m => {
      if (m.poNumber && m.poNumber !== 'N/A' && String(m.poNumber).trim()) {
        set.add(String(m.poNumber).trim());
      }
    });
    return Array.from(set).sort();
  }, [pos, materials]);

  const vendorSuggestions = useMemo(() => {
    const set = new Set();
    (vendors || []).forEach(v => {
      const name = typeof v === 'string' ? v : (v.name || v.vendorName);
      if (name && String(name).trim()) set.add(String(name).trim());
    });
    (materials || []).forEach(m => {
      const v = m.vendorName || m.vendor || m.supplier;
      if (v && String(v).trim()) set.add(String(v).trim());
    });
    return Array.from(set).sort();
  }, [vendors, materials]);

  // Handle Edit Material Update Submit
  const handleUpdateSubmit = (e) => {
    e.preventDefault();
    if (!matName.trim()) {
      setMatError('Material Name is required.');
      return;
    }
    const effectiveStCode = matItemCode ? matItemCode.trim().toUpperCase() : getSTCode(editingMaterial);
    const updated = {
      ...editingMaterial,
      itemCode: effectiveStCode,
      name: matName.trim(),
      category: matCategory ? matCategory.trim() : 'FABRICS',
      stock: parseFloat(matStock) || 0,
      unit: matUnit ? matUnit.trim() : 'Pcs',
      cost: parseFloat(matCost) || 0,
      threshold: parseFloat(matThreshold) || 50,
      color: matColor ? matColor.trim() : 'Default',
      location: matLocation ? matLocation.trim() : 'Main Store',
      poNumber: matPoNumber ? matPoNumber.trim() : (editingMaterial.poNumber || 'N/A'),
      vendorName: matVendorName ? matVendorName.trim() : (editingMaterial.vendorName || ''),
      policy: matUpdatePolicy,
      updatePolicy: matUpdatePolicy
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
    const autoStNum = Math.floor(10000 + Math.random() * 90000);
    const effectiveStCode = matItemCode ? matItemCode.trim().toUpperCase() : `ST${autoStNum}`;
    const newId = effectiveStCode;
    const newMat = {
      id: newId,
      itemCode: effectiveStCode,
      name: matName.trim(),
      category: matCategory ? matCategory.trim() : 'FABRICS',
      stock: parseFloat(matStock) || 0,
      unit: matUnit ? matUnit.trim() : 'Pcs',
      cost: parseFloat(matCost) || 0,
      threshold: parseFloat(matThreshold) || 50,
      color: matColor ? matColor.trim() : 'Default',
      location: matLocation ? matLocation.trim() : 'Main Store',
      packets: 1,
      poNumber: matPoNumber ? matPoNumber.trim() : 'N/A',
      vendorName: matVendorName ? matVendorName.trim() : '',
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
    setMatPoNumber('');
    setMatVendorName('');
    setMatError('');
  };

  // Filter materials: only show present materials (stock > 0)
  const filteredMaterials = (materials || []).filter(m => {
    if (Number(m.stock) <= 0) return false;
    const q = matSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const st = getSTCode(m).toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      st.includes(q) ||
      (m.category || '').toLowerCase().includes(q) ||
      (m.color || '').toLowerCase().includes(q) ||
      (m.location || '').toLowerCase().includes(q) ||
      (m.poNumber || '').toLowerCase().includes(q) ||
      (m.vendorName || '').toLowerCase().includes(q)
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
          {/* ── Material Pricing & Stock Valuation Policy (FCFS / FIFO) ── */}
          {/* ── Updated Material Prices & Stock Valuation Panel ── */}
          <div className="panel" style={{
            marginBottom: 0,
            border: '1.5px solid rgba(59, 130, 246, 0.3)',
            background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.02) 0%, var(--bg-primary) 100%)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
          }}>
            {/* Panel Header */}
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '9px',
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 className="panel-title" style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>
                      Updated Material Prices
                    </h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: updatedPriceMaterials.length > 0 ? '#dbeafe' : 'var(--bg-secondary)',
                      color: updatedPriceMaterials.length > 0 ? '#1e40af' : 'var(--text-muted)',
                      border: `1px solid ${updatedPriceMaterials.length > 0 ? '#bfdbfe' : 'var(--border-color)'}`
                    }}>
                      {updatedPriceMaterials.length} Updated
                    </span>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: '800',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      background: 'rgba(37, 99, 235, 0.08)',
                      color: '#2563eb',
                      border: '1px solid rgba(37, 99, 235, 0.2)'
                    }}>
                      ⚡ FCFS Automated
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Before vs. New purchase price tracking with automated First-Come First-Served tier inventory valuation.
                  </p>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleRevalueAllStock}
                  disabled={revaluingStock}
                  style={{ fontSize: '11.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Synchronize all inventory batches to latest registered item code rates"
                >
                  <RefreshCw size={13} className={revaluingStock ? 'spin' : ''} />
                  <span>{revaluingStock ? 'Revaluing...' : 'Revalue All Stock'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={fetchPriceUpdates}
                  disabled={loadingPriceUpdates}
                  style={{ fontSize: '11.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Refresh updated prices"
                >
                  <RefreshCw size={13} className={loadingPriceUpdates ? 'spin' : ''} />
                  <span>{loadingPriceUpdates ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            {/* Notification alert if any */}
            {pricingPolicyMsg && (
              <div style={{
                padding: '9px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                margin: '12px 0 6px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: pricingPolicyMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
                color: pricingPolicyMsg.type === 'success' ? '#047857' : '#b91c1c',
                border: `1px solid ${pricingPolicyMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`
              }}>
                {pricingPolicyMsg.type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                <span>{pricingPolicyMsg.text}</span>
              </div>
            )}

            {/* Quick Metrics Summary Strip (if items exist) */}
            {updatedPriceMaterials.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                margin: '12px 0'
              }}>
                <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Updated Materials</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-main)', marginTop: '1px' }}>{updatedPriceMaterials.length}</div>
                </div>
                <div style={{ padding: '8px 10px', background: 'rgba(22, 163, 74, 0.05)', borderRadius: '8px', border: '1px solid rgba(22, 163, 74, 0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Price Increased</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#15803d', marginTop: '1px' }}>
                    {updatedPriceMaterials.filter(m => (m.priceDiff || 0) > 0).length}
                  </div>
                </div>
                <div style={{ padding: '8px 10px', background: 'rgba(220, 38, 38, 0.05)', borderRadius: '8px', border: '1px solid rgba(220, 38, 38, 0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Price Decreased</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#b91c1c', marginTop: '1px' }}>
                    {updatedPriceMaterials.filter(m => (m.priceDiff || 0) < 0).length}
                  </div>
                </div>
              </div>
            )}

            {/* Loading state */}
            {loadingPriceUpdates && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                <RefreshCw size={18} className="spin" style={{ margin: '0 auto 8px auto', display: 'block', color: '#2563eb' }} />
                Checking for updated material rates and FCFS batches...
              </div>
            )}

            {/* Error state */}
            {priceUpdatesError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '12.5px',
                margin: '12px 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{priceUpdatesError}</span>
                <button type="button" onClick={fetchPriceUpdates} className="btn btn-secondary btn-xs" style={{ fontSize: '11px' }}>
                  Retry
                </button>
              </div>
            )}

            {/* Empty state: No price updates recorded */}
            {!loadingPriceUpdates && !priceUpdatesError && updatedPriceMaterials.length === 0 && (
              <div style={{
                padding: '24px 18px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.03)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                margin: '14px 0'
              }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb'
                }}>
                  <Info size={18} />
                </div>
                <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>
                  No Material Price Updates Recorded Yet
                </strong>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', maxWidth: '440px', lineHeight: '1.45' }}>
                  Only materials where purchase rates have changed (for example, Tag @ ₹1.00/pc updating to ₹1.50/pc during inward) appear here with Before Price, New Price, and remaining stock valuation breakdown.
                </p>
              </div>
            )}

            {/* Materials List */}
            {!loadingPriceUpdates && !priceUpdatesError && updatedPriceMaterials.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                {/* Search Bar & Filter Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search updated material by name or code..."
                      value={priceSearchQuery}
                      onChange={(e) => setPriceSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px 7px 30px',
                        fontSize: '12px',
                        borderRadius: '7px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-main)'
                      }}
                    />
                    {priceSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setPriceSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '2px'
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setPriceFilter('all')}
                      style={{
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        borderRadius: '6px',
                        border: priceFilter === 'all' ? '1px solid #2563eb' : '1px solid var(--border-color)',
                        background: priceFilter === 'all' ? '#dbeafe' : 'var(--bg-secondary)',
                        color: priceFilter === 'all' ? '#1e40af' : 'var(--text-main)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      All ({updatedPriceMaterials.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceFilter('increased')}
                      style={{
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        borderRadius: '6px',
                        border: priceFilter === 'increased' ? '1px solid #16a34a' : '1px solid var(--border-color)',
                        background: priceFilter === 'increased' ? '#dcfce7' : 'var(--bg-secondary)',
                        color: priceFilter === 'increased' ? '#15803d' : 'var(--text-main)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Increased ({updatedPriceMaterials.filter(m => (m.priceDiff || 0) > 0).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceFilter('decreased')}
                      style={{
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        borderRadius: '6px',
                        border: priceFilter === 'decreased' ? '1px solid #dc2626' : '1px solid var(--border-color)',
                        background: priceFilter === 'decreased' ? '#fee2e2' : 'var(--bg-secondary)',
                        color: priceFilter === 'decreased' ? '#b91c1c' : 'var(--text-main)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Decreased ({updatedPriceMaterials.filter(m => (m.priceDiff || 0) < 0).length})
                    </button>
                  </div>
                </div>

                {/* Filtered Materials List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', maxHeight: '460px', overflowY: 'auto', paddingRight: '4px' }}>
                  {filteredUpdatedMaterials.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No matching materials found for "{priceSearchQuery}".
                    </div>
                  ) : (
                    filteredUpdatedMaterials.map(m => {
                      const isUp = (m.priceDiff || 0) > 0;
                      const isDown = (m.priceDiff || 0) < 0;
                      return (
                        <div
                          key={m.materialId || m.itemCode}
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                            transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                          }}
                        >
                          {/* Top Row: ST Code, Material Name, Unit, and Actions */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '9px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  fontFamily: 'monospace',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  border: '1px solid #bfdbfe'
                                }}>
                                  {getSTCode(m) || m.itemCode}
                                </span>
                                <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>
                                  {m.materialName}
                                </strong>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                  ({m.unit || 'Pcs'})
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                <Clock size={11.5} />
                                <span>Updated: {m.lastUpdatedAt || 'Recent'}</span>
                                <span>&bull;</span>
                                <span>{m.updateReason}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedBatchMaterial(m)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11.5px',
                                fontWeight: '700',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #93c5fd',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                cursor: 'pointer',
                                flexShrink: 0,
                                transition: 'all 0.15s ease'
                              }}
                              title="Inspect all inward batches"
                            >
                              <span>View Batches</span>
                              <ChevronRight size={13} />
                            </button>
                          </div>

                          {/* Rate Comparison Box: Before Price vs New Price */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto 1fr',
                            alignItems: 'center',
                            gap: '10px',
                            background: 'var(--bg-primary)',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            marginBottom: '8px'
                          }}>
                            {/* Before Price */}
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                                Before Price
                              </div>
                              <div style={{
                                fontSize: '15px',
                                fontWeight: '800',
                                color: '#475569',
                                textDecoration: (m.priceDiff !== 0) ? 'line-through' : 'none'
                              }}>
                                ₹{Number(m.beforePrice || 0).toFixed(2)}
                              </div>
                              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Old Stock: <strong>{Number(m.oldStockRemaining || 0).toLocaleString()}</strong> {m.unit}
                              </div>
                            </div>

                            {/* Arrow & Difference Badge */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <ArrowRight size={15} style={{ color: isUp ? '#16a34a' : isDown ? '#dc2626' : 'var(--text-muted)' }} />
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '800',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: isUp ? '#dcfce7' : isDown ? '#fee2e2' : '#f1f5f9',
                                color: isUp ? '#15803d' : isDown ? '#b91c1c' : '#475569'
                              }}>
                                {isUp ? `+₹${m.priceDiff.toFixed(2)} (+${m.percentChange}%)` : isDown ? `-₹${Math.abs(m.priceDiff).toFixed(2)} (${m.percentChange}%)` : 'Unchanged'}
                              </span>
                            </div>

                            {/* New Price */}
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#2563eb', marginBottom: '2px' }}>
                                New Price
                              </div>
                              <div style={{ fontSize: '16px', fontWeight: '900', color: isUp ? '#15803d' : isDown ? '#b91c1c' : '#1d4ed8' }}>
                                ₹{Number(m.newPrice || 0).toFixed(2)}
                              </div>
                              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                New Stock: <strong>{Number(m.newStockRemaining || 0).toLocaleString()}</strong> {m.unit}
                              </div>
                            </div>
                          </div>

                          {/* FCFS Valuation Breakdown Pill */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                            fontSize: '11px',
                            padding: '6px 10px',
                            background: 'rgba(37, 99, 235, 0.04)',
                            borderRadius: '6px',
                            border: '1px solid rgba(37, 99, 235, 0.12)'
                          }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              Valuation: <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{m.breakdownText}</strong>
                            </span>
                            <span style={{ fontWeight: '800', color: '#1e40af' }}>
                              Total: {Number(m.currentStock || 0).toLocaleString()} {m.unit} = ₹{Number(m.totalValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <th style={{ width: '130px', minWidth: '110px' }}>ST ID</th>
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
                filteredMaterials.map(m => {
                  const stCode = getSTCode(m);
                  return (
                    <tr key={m.id}>
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
                          {stCode}
                        </span>
                      </td>
                      <td>
                        <strong style={{ display: 'block', fontSize: '14px' }}>{m.name}</strong>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {m.poNumber && m.poNumber !== 'N/A' && (
                            <span style={{ fontSize: '11px', color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                              PO: {m.poNumber}
                            </span>
                          )}
                          {m.vendorName && (
                            <span style={{ fontSize: '11px', color: '#15803d', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                              Vendor: {m.vendorName}
                            </span>
                          )}
                          {m.color && m.color !== 'Default' && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Color: {m.color}</span>
                          )}
                          {m.location && m.location !== 'Default' && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Loc: {m.location}</span>
                          )}
                        </div>
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
                              setMatItemCode(stCode);
                              setMatName(m.name || '');
                              setMatCategory(m.category || 'FABRICS');
                              setMatStock(m.stock !== undefined ? m.stock : '');
                              setMatUnit(m.unit || 'Pcs');
                              setMatCost(m.cost !== undefined ? m.cost : 0);
                              setMatThreshold(m.threshold !== undefined ? m.threshold : 50);
                              setMatColor(m.color || '');
                              setMatLocation(m.location || '');
                              setMatPoNumber(m.poNumber && m.poNumber !== 'N/A' ? m.poNumber : '');
                              setMatVendorName(m.vendorName || m.vendor || m.supplier || '');
                              setMatUpdatePolicy(materialPricingPolicy || 'fcfs');
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
                  );
                })
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
                  <label className="form-label">ST ID (Master Item Code)</label>
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

              {/* Price Update Scope (FCFS vs Update Both) */}
              <div style={{
                background: '#f8fafc',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                marginBottom: '16px'
              }}>
                <label className="form-label" style={{ fontWeight: '800', color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Price Update Valuation Scope</span>
                  <span style={{ fontSize: '11px', background: matUpdatePolicy === 'fcfs' ? '#dbeafe' : '#ffedd5', color: matUpdatePolicy === 'fcfs' ? '#1e40af' : '#9a3412', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>
                    {matUpdatePolicy === 'fcfs' ? '⚡ FCFS / FIFO' : '🔄 Global Revalue'}
                  </span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{
                    display: 'flex', flexDirection: 'column', padding: '10px 12px', borderRadius: '8px',
                    border: matUpdatePolicy === 'fcfs' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: matUpdatePolicy === 'fcfs' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '12.5px', color: matUpdatePolicy === 'fcfs' ? '#1d4ed8' : '#334155' }}>
                      <input
                        type="radio"
                        name="matModalPolicy"
                        value="fcfs"
                        checked={matUpdatePolicy === 'fcfs'}
                        onChange={() => setMatUpdatePolicy('fcfs')}
                      />
                      <span>FCFS (Keep Old Stock Cost)</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', lineHeight: '1.3' }}>
                      Existing {editingMaterial.stock || 0} {editingMaterial.unit || 'pcs'} retain historical cost; new rate applies to future stock.
                    </span>
                  </label>

                  <label style={{
                    display: 'flex', flexDirection: 'column', padding: '10px 12px', borderRadius: '8px',
                    border: matUpdatePolicy === 'update_all' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                    background: matUpdatePolicy === 'update_all' ? '#fff7ed' : '#ffffff',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '12.5px', color: matUpdatePolicy === 'update_all' ? '#c2410c' : '#334155' }}>
                      <input
                        type="radio"
                        name="matModalPolicy"
                        value="update_all"
                        checked={matUpdatePolicy === 'update_all'}
                        onChange={() => setMatUpdatePolicy('update_all')}
                      />
                      <span>Update Both (Old & New Stock)</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', lineHeight: '1.3' }}>
                      Revalue all {editingMaterial.stock || 0} {editingMaterial.unit || 'pcs'} of existing stock & past batches to {currencySymbol}{matCost || 0}.
                    </span>
                  </label>
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

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">PO Number (Purchase Order No)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={matPoNumber}
                    onChange={(e) => setMatPoNumber(e.target.value)}
                    placeholder="e.g. PO-84102, PO-1029..."
                    list="settings-po-suggestions"
                  />
                  <datalist id="settings-po-suggestions">
                    {poSuggestions.map((p, idx) => (
                      <option key={idx} value={p} />
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label className="form-label">Vendor / Supplier Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={matVendorName}
                    onChange={(e) => setMatVendorName(e.target.value)}
                    placeholder="e.g. YKK India, Vardhman, Apex Trims..."
                    list="settings-vendor-suggestions"
                  />
                  <datalist id="settings-vendor-suggestions">
                    {vendorSuggestions.map((v, idx) => (
                      <option key={idx} value={v} />
                    ))}
                  </datalist>
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
                  <label className="form-label">ST ID (Master Item Code)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ST00001 (auto-generated if empty)"
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

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">PO Number (Purchase Order No)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. PO-84102, PO-1029..."
                    value={matPoNumber}
                    onChange={(e) => setMatPoNumber(e.target.value)}
                    list="settings-po-suggestions-add"
                  />
                  <datalist id="settings-po-suggestions-add">
                    {poSuggestions.map((p, idx) => (
                      <option key={idx} value={p} />
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label className="form-label">Vendor / Supplier Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. YKK India, Vardhman, Apex Trims..."
                    value={matVendorName}
                    onChange={(e) => setMatVendorName(e.target.value)}
                    list="settings-vendor-suggestions-add"
                  />
                  <datalist id="settings-vendor-suggestions-add">
                    {vendorSuggestions.map((v, idx) => (
                      <option key={idx} value={v} />
                    ))}
                  </datalist>
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

      {/* ── FCFS Batches & Price History Modal ── */}
      {selectedBatchMaterial && (
        <div className="modal-overlay" style={{
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
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '750px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(90deg, rgba(37,99,235,0.06) 0%, transparent 100%)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '11.5px',
                    fontWeight: '800',
                    padding: '2px 8px',
                    borderRadius: '5px',
                    background: '#dbeafe',
                    color: '#1e40af',
                    fontFamily: 'monospace'
                  }}>
                    {getSTCode(selectedBatchMaterial) || selectedBatchMaterial.itemCode}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>
                    {selectedBatchMaterial.materialName}
                  </h3>
                </div>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  FCFS Inward Batches & Rate Valuation History &bull; Unit: {selectedBatchMaterial.unit || 'Pcs'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatchMaterial(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {/* Top Metric Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>Before Price (Old)</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#475569', marginTop: '2px' }}>
                    ₹{Number(selectedBatchMaterial.beforePrice || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Old Stock: {Number(selectedBatchMaterial.oldStockRemaining || 0).toLocaleString()} {selectedBatchMaterial.unit}
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: '700' }}>New Price (Latest)</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#1d4ed8', marginTop: '2px' }}>
                    ₹{Number(selectedBatchMaterial.newPrice || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '11px', color: selectedBatchMaterial.priceDiff > 0 ? '#15803d' : '#b91c1c', fontWeight: '700', marginTop: '2px' }}>
                    {selectedBatchMaterial.priceDiff > 0 ? `+₹${selectedBatchMaterial.priceDiff.toFixed(2)} (+${selectedBatchMaterial.percentChange}%)` : `-₹${Math.abs(selectedBatchMaterial.priceDiff).toFixed(2)} (${selectedBatchMaterial.percentChange}%)`}
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: '700' }}>Total Valuation</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#1e3a8a', marginTop: '2px' }}>
                    ₹{Number(selectedBatchMaterial.totalValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Stock: {Number(selectedBatchMaterial.currentStock || 0).toLocaleString()} {selectedBatchMaterial.unit}
                  </div>
                </div>
              </div>

              {/* Inward Batches Table */}
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>
                Chronological Inward Batches (FCFS Order)
              </h4>
              {(!selectedBatchMaterial.batches || selectedBatchMaterial.batches.length === 0) ? (
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No individual weighbridge batch records found. Valuation calculated from registered rate.
                </p>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '9px 12px' }}>Batch</th>
                        <th style={{ padding: '9px 12px' }}>Inward Date</th>
                        <th style={{ padding: '9px 12px' }}>PO / Invoice</th>
                        <th style={{ padding: '9px 12px' }}>Purchase Rate</th>
                        <th style={{ padding: '9px 12px' }}>Initial Qty</th>
                        <th style={{ padding: '9px 12px' }}>Remaining</th>
                        <th style={{ padding: '9px 12px' }}>Batch Value</th>
                        <th style={{ padding: '9px 12px' }}>FCFS Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBatchMaterial.batches.map((b, idx) => {
                        const isDepleted = b.isDepleted || b.remainingPieces <= 0;
                        const isActive = b.isActiveTier;
                        return (
                          <tr key={b.id || idx} style={{
                            borderBottom: '1px solid var(--border-color)',
                            background: isActive ? 'rgba(37,99,235,0.06)' : isDepleted ? 'rgba(0,0,0,0.02)' : 'transparent',
                            opacity: isDepleted ? 0.6 : 1
                          }}>
                            <td style={{ padding: '9px 12px', fontWeight: '700' }}>#{idx + 1}</td>
                            <td style={{ padding: '9px 12px' }}>{b.date || '—'} <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{b.time || ''}</span></td>
                            <td style={{ padding: '9px 12px' }}>
                              <div>{b.poNumber ? `PO: ${b.poNumber}` : 'Direct Inward'}</div>
                              {b.invoiceNo && <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Inv: {b.invoiceNo}</div>}
                            </td>
                            <td style={{ padding: '9px 12px', fontWeight: '800', color: b.rate === selectedBatchMaterial.newPrice ? '#15803d' : '#475569' }}>
                              ₹{Number(b.rate || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '9px 12px' }}>{Number(b.initialPieces || 0).toLocaleString()}</td>
                            <td style={{ padding: '9px 12px', fontWeight: '700' }}>{Number(b.remainingPieces || 0).toLocaleString()}</td>
                            <td style={{ padding: '9px 12px', fontWeight: '800' }}>
                              ₹{Number(b.amount || (b.remainingPieces * b.rate) || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '800',
                                padding: '2px 7px',
                                borderRadius: '5px',
                                background: isActive ? '#dbeafe' : isDepleted ? '#f1f5f9' : '#e0e7ff',
                                color: isActive ? '#1e40af' : isDepleted ? '#64748b' : '#3730a3',
                                border: `1px solid ${isActive ? '#93c5fd' : isDepleted ? '#cbd5e1' : '#c7d2fe'}`
                              }}>
                                {isActive ? '⚡ Active (Consuming)' : isDepleted ? '✓ Depleted' : '⏳ Next in Queue'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Price History Log (if any) */}
              {selectedBatchMaterial.history && selectedBatchMaterial.history.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '12.5px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={14} style={{ color: '#2563eb' }} />
                    Price Change Audit Trail
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedBatchMaterial.history.map((h, hIdx) => (
                      <div key={h.id || hIdx} style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: 'var(--bg-secondary)',
                        fontSize: '11.5px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          Rate changed from <strong style={{ color: '#b91c1c' }}>₹{h.oldRate}</strong> to <strong style={{ color: '#15803d' }}>₹{h.newRate}</strong> &bull; Policy: {h.policy?.toUpperCase()} &bull; Reason: {h.reason || 'Rate Update'}
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{h.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--bg-secondary)'
            }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setSelectedBatchMaterial(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
