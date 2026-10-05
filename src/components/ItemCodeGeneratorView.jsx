import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Tag, PlusCircle, Search, RefreshCw, Download, FileText,
  Trash2, X, Check, QrCode, Filter, Sparkles, Layers, Box, CheckCircle2, Copy, History, ArrowDownRight, ArrowUpRight,
  Settings, Link2, Unlink, Zap, CheckCircle, AlertCircle, ArrowRight, ExternalLink, SlidersHorizontal, ChevronRight,
  Edit3, Pencil, Printer
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBackendUrl } from '../utils/api';

// Local storage helpers
const getLocalStorageItem = (key, fallback) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (_) {
    return fallback;
  }
};

const setLocalStorageItem = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) { }
};

// Generate QR Code data URL helper
const toDataURL_QR = async (text, size = 220) => {
  try {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
  } catch (err) {
    return null;
  }
};

const fmtMoney = (val) => {
  const num = parseFloat(val) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const DEFAULT_CATEGORIES = [
  'Trims', 'Tags', 'Labels', 'Patch', 'Metal Patch', 'Tapes', 'Fabric', 'Packaging', 'Accessories', 'Thread', 'Dori', 'Zip', 'Elastic', 'Bone'
];

const DEFAULT_UOMS = [
  'PCS', 'MTR', 'KG', 'PKT', 'GROSS', 'ROLL', 'SET', 'BOX', 'PAIR', 'YARD', 'DOZEN'
];

// Helper to guarantee clean, unbroken ST00001 sequence
const sanitizeItemCodesList = (list) => {
  if (!Array.isArray(list)) return [];
  const needsFix = list.some(ic => !/^ST\d{5}$/i.test(String(ic.item_code || '')));
  if (needsFix) {
    const sorted = [...list].sort((a, b) => {
      const matchA = String(a.item_code || '').match(/^ST(\d+)$/i);
      const matchB = String(b.item_code || '').match(/^ST(\d+)$/i);
      if (matchA && matchB) return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
      if (matchA) return -1;
      if (matchB) return 1;
      return (a.id || 0) - (b.id || 0);
    });
    return sorted.map((ic, i) => ({
      ...ic,
      item_code: `ST${String(i + 1).padStart(5, '0')}`
    })).reverse();
  }
  return list;
};

export default function ItemCodeGeneratorView() {
  const [dbItemCodes, setDbItemCodes] = useState(() =>
    sanitizeItemCodesList(getLocalStorageItem('po_saved_item_codes', []))
  );

  // Dynamic Categories State
  const [customCategories, setCustomCategories] = useState(() =>
    getLocalStorageItem('item_code_custom_categories', [])
  );
  const categories = useMemo(() => {
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories]));
  }, [customCategories]);

  // Dynamic UOMs State
  const [customUoms, setCustomUoms] = useState(() =>
    getLocalStorageItem('item_code_custom_uoms', [])
  );
  const uoms = useMemo(() => {
    return Array.from(new Set([...DEFAULT_UOMS, ...customUoms]));
  }, [customUoms]);

  // Dialog States
  const [showAddCatDialog, setShowAddCatDialog] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [showAddUomDialog, setShowAddUomDialog] = useState(false);
  const [newUomInput, setNewUomInput] = useState('');

  // Ledger / Movement History Modal State
  const [selectedLedgerItem, setSelectedLedgerItem] = useState(null);
  const [ledgerLogs, setLedgerLogs] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Settings & MT Code Mapping Modal States
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappingData, setMappingData] = useState({ mappings: [], unlinkedWc: [], totalItemCodes: 0, totalWc: 0 });
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [mappingSearchQuery, setMappingSearchQuery] = useState('');
  const [mappingTab, setMappingTab] = useState('mappings'); // 'mappings' | 'unlinked'
  const [mappingFilter, setMappingFilter] = useState('all'); // 'all' | 'mapped' | 'unmapped'
  const [mappingActionStatus, setMappingActionStatus] = useState(null);
  const [editingMapping, setEditingMapping] = useState({}); // { [item_code]: mt_code }
  const [savingMappingCode, setSavingMappingCode] = useState(null);

  const [loadingItemCodes, setLoadingItemCodes] = useState(false);
  const [icItemName, setIcItemName] = useState('');
  const [icBrand, setIcBrand] = useState('');
  const [icStyle, setIcStyle] = useState('');
  const [icCategory, setIcCategory] = useState('Trims');
  const [icUom, setIcUom] = useState('PCS');
  const [icRate, setIcRate] = useState('');
  const [icMtCode, setIcMtCode] = useState('');
  const [icSearchQuery, setIcSearchQuery] = useState('');
  const [icCategoryFilter, setIcCategoryFilter] = useState('all');
  const [createdItemCodePopup, setCreatedItemCodePopup] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [filteredItemCodes, setFilteredItemCodes] = useState([]);

  // Edit Item Code Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    id: null,
    item_code: '',
    mt_code: '',
    item_name: '',
    brand: '',
    style: '',
    category: 'Trims',
    uom: 'PCS',
    rate: ''
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Fetch Item Codes from MySQL Database
  const fetchItemCodes = useCallback(async () => {
    try {
      setLoadingItemCodes(true);
      const res = await fetch(`${getBackendUrl()}/api/item-codes`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.itemCodes)) {
          const cleaned = sanitizeItemCodesList(data.itemCodes);
          setDbItemCodes(cleaned);
          setLocalStorageItem('po_saved_item_codes', cleaned);
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch item codes from DB:", err);
    } finally {
      setLoadingItemCodes(false);
    }
  }, []);

  // Fetch MT Code Mappings from MySQL Database
  const fetchMappings = useCallback(async () => {
    try {
      setLoadingMappings(true);
      const res = await fetch(`${getBackendUrl()}/api/item-codes/mappings`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMappingData({
            mappings: data.mappings || [],
            unlinkedWc: data.unlinkedWc || [],
            totalItemCodes: data.totalItemCodes || (data.mappings || []).length,
            totalWc: data.totalWc || 0
          });
        }
      }
    } catch (err) {
      console.warn("Failed to fetch mappings:", err);
    } finally {
      setLoadingMappings(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItemCodes();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchItemCodes]);

  // Handlers for Adding & Deleting Categories
  const handleAddCategory = (catToAdd = newCatInput) => {
    const trimmed = (catToAdd || '').trim();
    if (!trimmed) return;
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      alert(`Category "${trimmed}" already exists.`);
      setIcCategory(trimmed);
      setShowAddCatDialog(false);
      setNewCatInput('');
      return;
    }
    const updated = [...customCategories, trimmed];
    setCustomCategories(updated);
    setLocalStorageItem('item_code_custom_categories', updated);
    setIcCategory(trimmed);
    setNewCatInput('');
    setShowAddCatDialog(false);
  };

  const handleDeleteCategory = (catToDelete) => {
    const updated = customCategories.filter(c => c !== catToDelete);
    setCustomCategories(updated);
    setLocalStorageItem('item_code_custom_categories', updated);
    if (icCategory === catToDelete) {
      setIcCategory('Trims');
    }
  };

  // Handlers for Adding & Deleting UOMs
  const handleAddUom = (uomToAdd = newUomInput) => {
    const trimmed = (uomToAdd || '').trim().toUpperCase();
    if (!trimmed) return;
    if (uoms.some(u => u.toLowerCase() === trimmed.toLowerCase())) {
      alert(`UOM "${trimmed}" already exists.`);
      setIcUom(trimmed);
      setShowAddUomDialog(false);
      setNewUomInput('');
      return;
    }
    const updated = [...customUoms, trimmed];
    setCustomUoms(updated);
    setLocalStorageItem('item_code_custom_uoms', updated);
    setIcUom(trimmed);
    setNewUomInput('');
    setShowAddUomDialog(false);
  };

  const handleDeleteUom = (uomToDelete) => {
    const updated = customUoms.filter(u => u !== uomToDelete);
    setCustomUoms(updated);
    setLocalStorageItem('item_code_custom_uoms', updated);
    if (icUom === uomToDelete) {
      setIcUom('PCS');
    }
  };

  // Open Movement Ledger Modal for a specific Item Code
  const handleOpenLedgerModal = async (icRecord) => {
    setSelectedLedgerItem(icRecord);
    setLoadingLedger(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/item-code-ledger/${encodeURIComponent(icRecord.item_code)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.ledger)) {
          setLedgerLogs(data.ledger);
          return;
        }
      }
      setLedgerLogs([]);
    } catch (err) {
      console.error("Failed to load item code ledger:", err);
      setLedgerLogs([]);
    } finally {
      setLoadingLedger(false);
    }
  };

  // Generate Unique Item Code Sequence
  const generateUniqueItemCode = () => {
    let maxSeq = 0;
    dbItemCodes.forEach(ic => {
      const code = String(ic.item_code || '').trim();
      const match = code.match(/^ST(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(5, '0');
    return `ST${nextSeq}`;
  };

  // Handle Create Single Item Code
  const handleCreateItemCode = async (e) => {
    if (e) e.preventDefault();
    if (!icItemName.trim()) {
      alert("Please enter Item Name.");
      return;
    }

    // Duplicate Detection: block if item_name + brand + category + uom all match
    const inputName = icItemName.trim().toLowerCase();
    const inputBrand = (icBrand.trim() || 'General').toLowerCase();
    const inputCategory = (icCategory || 'Trims').toLowerCase();
    const inputUom = (icUom || 'PCS').toLowerCase();

    const existingDuplicate = dbItemCodes.find(item => {
      const sameName = (item.item_name || '').toLowerCase() === inputName;
      const sameBrand = (item.brand || 'General').toLowerCase() === inputBrand;
      const sameCat = (item.category || 'Trims').toLowerCase() === inputCategory;
      const sameUom = (item.uom || 'PCS').toLowerCase() === inputUom;
      return sameName && sameBrand && sameCat && sameUom;
    });

    if (existingDuplicate) {
      setDuplicateWarning({ existingItem: existingDuplicate });
      return;
    }

    const generatedCode = generateUniqueItemCode();
    const newRecord = {
      item_code: generatedCode,
      item_name: icItemName.trim(),
      brand: icBrand.trim() || 'General',
      style: icStyle.trim() || 'N/A',
      category: icCategory || 'Trims',
      uom: icUom || 'PCS',
      rate: parseFloat(icRate) || 0,
      mt_code: icMtCode.trim(),
      created_at: new Date().toISOString()
    };

    try {
      const res = await fetch(`${getBackendUrl()}/api/item-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.itemCode) {
          newRecord.id = data.itemCode.id;
        }
      }
    } catch (err) {
      console.warn("Server store warning:", err);
    }

    const updatedList = [newRecord, ...dbItemCodes.filter(c => c.item_code !== generatedCode)];
    setDbItemCodes(updatedList);
    setLocalStorageItem('po_saved_item_codes', updatedList);

    const qrData = await toDataURL_QR(generatedCode, 240);

    setCreatedItemCodePopup({
      ...newRecord,
      qrDataUrl: qrData
    });

    setIcItemName('');
    setIcBrand('');
    setIcStyle('');
    setIcRate('');
    setIcMtCode('');
  };

  const handleDeleteItemCode = async (id, itemCode) => {
    if (!window.confirm(`Are you sure you want to delete item code ${itemCode}?`)) return;
    try {
      await fetch(`${getBackendUrl()}/api/item-codes/${id}`, { method: 'DELETE' });
    } catch (_) { }
    const updated = dbItemCodes.filter(c => c.id !== id && c.item_code !== itemCode);
    setDbItemCodes(updated);
    setLocalStorageItem('po_saved_item_codes', updated);
  };

  // ── Mapping Manager Handlers ──────────────────────────────────────────────
  const handleSaveSingleMapping = async (itemCode, mtCode) => {
    const targetMt = (mtCode !== undefined ? mtCode : editingMapping[itemCode] || '').trim();
    setSavingMappingCode(itemCode);
    try {
      const res = await fetch(`${getBackendUrl()}/api/item-codes/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_code: itemCode, mt_code: targetMt })
      });
      if (res.ok) {
        setMappingActionStatus({
          type: 'success',
          msg: targetMt ? `Linked ${itemCode} ⇄ ${targetMt} successfully!` : `Unlinked MT Code from ${itemCode}`
        });
        setTimeout(() => setMappingActionStatus(null), 3000);
        // Refresh mapping data & item codes
        fetchMappings();
        fetchItemCodes();
      }
    } catch (err) {
      setMappingActionStatus({ type: 'error', msg: 'Failed to update mapping: ' + err.message });
      setTimeout(() => setMappingActionStatus(null), 4000);
    } finally {
      setSavingMappingCode(null);
    }
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setEditForm({
      id: item.id,
      item_code: item.item_code || '',
      mt_code: item.mt_code || '',
      item_name: item.item_name || '',
      brand: item.brand || '',
      style: item.style || '',
      category: item.category || 'Trims',
      uom: item.uom || 'PCS',
      rate: item.rate !== undefined && item.rate !== null ? item.rate : ''
    });
    setShowEditModal(true);
  };

  const handleSaveEditItem = async (e) => {
    if (e) e.preventDefault();
    if (!editForm.id || !editForm.item_code || !editForm.item_name) {
      alert('Item Code and Item Name are required');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/item-codes/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_code: editForm.item_code.trim(),
          mt_code: editForm.mt_code.trim(),
          item_name: editForm.item_name.trim(),
          brand: editForm.brand.trim(),
          style: editForm.style.trim(),
          category: editForm.category.trim(),
          uom: editForm.uom.trim(),
          rate: parseFloat(editForm.rate) || 0
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDbItemCodes(prev => prev.map(ic => ic.id === editForm.id ? { ...ic, ...data.itemCode } : ic));
        setShowEditModal(false);
        setCreatedItemCodePopup({
          code: editForm.item_code,
          message: `Item Code ${editForm.item_code} updated successfully!`
        });
        fetchItemCodes();
        fetchMappings();
      } else {
        alert('Failed to update Item Code: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error updating Item Code: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleGenerateTagsFromMt = async () => {
    if (!window.confirm("Generate Item Codes for all warehouse Tag MT codes starting from ST00094? All names, brands, categories and units will be preserved.")) return;
    setLoadingMappings(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/item-codes/generate-from-tags`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMappingActionStatus({
          type: 'success',
          msg: `🎉 Successfully generated ${data.createdCount || 0} tag item codes (ST00094+ series) and linked MT codes!`
        });
        await fetchItemCodes();
        await fetchMappings();
      } else {
        alert("Generation notice: " + (data.error || 'Check console'));
      }
    } catch (err) {
      alert("Failed to generate tags: " + err.message);
    } finally {
      setLoadingMappings(false);
    }
  };

  const handleGeneratePatchTapesFromMt = async () => {
    if (!window.confirm("Generate Item Codes for all warehouse Patch and Tape MT codes (ST00141+ series)? All names, brands, categories and UOMs will be preserved.")) return;
    setLoadingMappings(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/item-codes/generate-from-patch-tapes`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMappingActionStatus({
          type: 'success',
          msg: `🎉 Successfully generated ${data.createdCount || 0} patch & tape item codes (ST00141+ series) and linked MT codes!`
        });
        await fetchItemCodes();
        await fetchMappings();
      } else {
        alert("Generation notice: " + (data.error || 'Check console'));
      }
    } catch (err) {
      alert("Failed to generate patch & tapes: " + err.message);
    } finally {
      setLoadingMappings(false);
    }
  };

  const handleAutoMapAll = async () => {
    setLoadingMappings(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/item-codes/auto-map-all`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMappingActionStatus({
          type: 'success',
          msg: `⚡ Auto-mapped ${data.mappedCount || 0} Item Codes with warehouse MT materials!`
        });
        setTimeout(() => setMappingActionStatus(null), 4000);
        await fetchItemCodes();
        await fetchMappings();
      }
    } catch (err) {
      alert("Auto-mapping error: " + err.message);
    } finally {
      setLoadingMappings(false);
    }
  };

  const handleQuickCreateSTForUnlinkedMt = async (unlinkedWc) => {
    const nextCode = generateUniqueItemCode();
    const newRecord = {
      item_code: nextCode,
      item_name: (unlinkedWc.item_name || 'Material Item').trim(),
      brand: (unlinkedWc.brand || 'General').trim(),
      style: 'N/A',
      category: (unlinkedWc.category || 'Trims').trim(),
      uom: (unlinkedWc.uom || 'PCS').trim(),
      rate: 0,
      mt_code: unlinkedWc.mt_code
    };

    try {
      const res = await fetch(`${getBackendUrl()}/api/item-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      if (res.ok) {
        setMappingActionStatus({
          type: 'success',
          msg: `Created ${nextCode} and linked to ${unlinkedWc.mt_code} (${newRecord.item_name})!`
        });
        setTimeout(() => setMappingActionStatus(null), 3000);
        await fetchItemCodes();
        await fetchMappings();
      }
    } catch (err) {
      alert("Failed to create ST code: " + err.message);
    }
  };

  // Search/filter logic for Master Registry table
  useEffect(() => {
    const q = icSearchQuery.toLowerCase().trim();
    const result = dbItemCodes.filter(item => {
      const matchesCat = icCategoryFilter === 'all' || (item.category || '').toLowerCase() === icCategoryFilter.toLowerCase();
      let matchesQ = true;
      if (q) {
        const code = (item.item_code || '').toLowerCase();
        const mtCode = (item.mt_code || '').toLowerCase();
        const name = (item.item_name || '').toLowerCase();
        const brand = (item.brand || '').toLowerCase();
        const style = (item.style || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const uom = (item.uom || '').toLowerCase();
        matchesQ = code.includes(q) || mtCode.includes(q) || name.includes(q) || brand.includes(q) || style.includes(q) || cat.includes(q) || uom.includes(q);
      }
      return matchesCat && matchesQ;
    });
    setFilteredItemCodes(result);
  }, [dbItemCodes, icSearchQuery, icCategoryFilter]);

  // Filtered list for Mapping Manager modal
  const filteredMappings = useMemo(() => {
    const q = mappingSearchQuery.toLowerCase().trim();
    return (mappingData.mappings || []).filter(m => {
      const matchesFilter =
        mappingFilter === 'all' ? true :
        mappingFilter === 'mapped' ? m.isMapped :
        !m.isMapped;

      let matchesQ = true;
      if (q) {
        const code = (m.item_code || '').toLowerCase();
        const mt = (m.mt_code || '').toLowerCase();
        const name = (m.item_name || '').toLowerCase();
        const brand = (m.brand || '').toLowerCase();
        const cat = (m.category || '').toLowerCase();
        matchesQ = code.includes(q) || mt.includes(q) || name.includes(q) || brand.includes(q) || cat.includes(q);
      }
      return matchesFilter && matchesQ;
    });
  }, [mappingData.mappings, mappingFilter, mappingSearchQuery]);

  const filteredUnlinkedWc = useMemo(() => {
    const q = mappingSearchQuery.toLowerCase().trim();
    return (mappingData.unlinkedWc || []).filter(w => {
      if (!q) return true;
      const mt = (w.mt_code || '').toLowerCase();
      const name = (w.item_name || '').toLowerCase();
      const brand = (w.brand || '').toLowerCase();
      const cat = (w.category || '').toLowerCase();
      return mt.includes(q) || name.includes(q) || brand.includes(q) || cat.includes(q);
    });
  }, [mappingData.unlinkedWc, mappingSearchQuery]);

  // Compute ledger summary stats
  const ledgerStats = useMemo(() => {
    let inwardTotal = 0;
    let outwardTotal = 0;
    let netWeightTotal = 0;
    ledgerLogs.forEach(entry => {
      const q = parseFloat(entry.qty) || 0;
      const wt = parseFloat(entry.net_wt) || 0;
      if ((entry.transaction_type || '').toUpperCase() === 'INWARD') {
        inwardTotal += q;
        netWeightTotal += wt;
      } else if ((entry.transaction_type || '').toUpperCase() === 'OUTWARD') {
        outwardTotal += q;
      } else if ((entry.transaction_type || '').toUpperCase() === 'RETURN') {
        inwardTotal += q;
      }
    });
    return {
      inwardTotal,
      outwardTotal,
      balance: inwardTotal - outwardTotal,
      netWeightTotal
    };
  }, [ledgerLogs]);

  const handlePrintItemCodesPage = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups in your browser to open the printable document.');
      return;
    }

    const title = "SYSTEM ITEM CODES MASTER REGISTRY REPORT";
    const dateStr = new Date().toLocaleDateString('en-GB') + " " + new Date().toLocaleTimeString('en-IN');
    const totalCount = filteredItemCodes.length;
    const mappedItemsCount = filteredItemCodes.filter(ic => ic.mt_code).length;
    const unmappedItemsCount = totalCount - mappedItemsCount;

    // Calculate category breakdown
    const catCounts = {};
    filteredItemCodes.forEach(ic => {
      const cat = ic.category || 'Trims';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    const catBadgesHtml = Object.entries(catCounts)
      .map(([cat, count]) => `<span class="badge">${cat}: <strong>${count}</strong></span>`)
      .join(' ');

    const rowsHtml = filteredItemCodes.map((ic, idx) => `
      <tr>
        <td class="text-center text-muted" style="font-weight: 600;">${idx + 1}</td>
        <td><strong class="st-code">${ic.item_code || '—'}</strong></td>
        <td style="font-weight: 700; color: #0f172a;">${ic.item_name || '—'}</td>
        <td>${ic.brand || 'General'}</td>
        <td class="text-muted">${ic.style || 'N/A'}</td>
        <td><span class="cat-pill">${ic.category || 'Trims'}</span></td>
        <td class="text-center" style="font-weight: 600;">${ic.uom || 'PCS'}</td>
        <td class="text-right" style="font-weight: 700;">₹${fmtMoney(ic.rate || 0)}</td>
        <td class="text-center status-mapped">Active</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Item Codes Master Registry - Print Document</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm 8mm 12mm 8mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
          }
          body {
            background: #ffffff;
            font-size: 11px;
            line-height: 1.4;
            padding: 12px;
          }
          .no-print-bar {
            position: sticky;
            top: 0;
            z-index: 999;
            background: #1e293b;
            color: #ffffff;
            padding: 10px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 8px;
            margin-bottom: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          .no-print-bar * { color: #ffffff; }
          .btn-print {
            background: #2563eb;
            color: #ffffff !important;
            border: none;
            padding: 6px 16px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            font-size: 12px;
            margin-right: 8px;
          }
          .btn-close {
            background: #475569;
            color: #ffffff !important;
            border: none;
            padding: 6px 14px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            font-size: 12px;
          }
          @media print {
            .no-print-bar { display: none !important; }
            body { padding: 0; }
          }
          .header-frame {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 10px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .brand-title {
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 0.02em;
            color: #0f172a;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .brand-sub {
            font-size: 11px;
            color: #475569;
            margin-top: 2px;
          }
          .meta-box {
            text-align: right;
            font-size: 10.5px;
            color: #334155;
            line-height: 1.5;
          }
          .summary-bar {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
          }
          .summary-item {
            font-size: 11px;
          }
          .badge {
            background: #e2e8f0;
            padding: 2px 7px;
            border-radius: 4px;
            font-size: 10.5px;
            display: inline-block;
            margin-right: 4px;
          }
          table.data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
            table-layout: fixed;
          }
          table.data-table thead {
            display: table-header-group;
          }
          table.data-table tr {
            page-break-inside: avoid;
          }
          table.data-table th {
            background: #0f172a;
            color: #ffffff;
            font-weight: 800;
            text-align: left;
            padding: 6px 8px;
            border: 1px solid #0f172a;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }
          table.data-table td {
            padding: 5px 8px;
            border: 1px solid #cbd5e1;
            vertical-align: middle;
            word-wrap: break-word;
          }
          table.data-table tbody tr:nth-child(even) {
            background: #f8fafc;
          }
          .st-code {
            font-family: monospace;
            font-weight: 800;
            color: #1e40af;
          }
          .cat-pill {
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            padding: 1px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-muted { color: #64748b; }
          .status-mapped { color: #047857; font-weight: 700; font-size: 10px; }
          .footer-section {
            margin-top: 24px;
            page-break-inside: avoid;
            display: flex;
            justify-content: space-between;
            padding-top: 20px;
          }
          .sig-box {
            width: 200px;
            text-align: center;
          }
          .sig-line {
            border-top: 1px dashed #475569;
            margin-bottom: 6px;
          }
          .sig-text {
            font-size: 10.5px;
            font-weight: 700;
            color: #475569;
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div>
            <strong>🖨️ Print Preview:</strong> System Item Codes Master Registry (${totalCount} Records)
          </div>
          <div>
            <button class="btn-print" onclick="window.print()">🖨️ Print Document</button>
            <button class="btn-close" onclick="window.close()">✖ Close Window</button>
          </div>
        </div>

        <div class="header-frame">
          <div>
            <div class="brand-title">📦 MH STORE & ACCESSORIES</div>
            <div class="brand-sub">${title} — Official Registry</div>
          </div>
          <div class="meta-box">
            <div><strong>Print Date:</strong> ${dateStr}</div>
            <div><strong>Category Filter:</strong> ${icCategoryFilter === 'all' ? 'All Categories' : icCategoryFilter}</div>
            ${icSearchQuery ? `<div><strong>Search Query:</strong> "${icSearchQuery}"</div>` : ''}
          </div>
        </div>

        <div class="summary-bar">
          <div class="summary-item">
            Total Item Codes: <strong>${totalCount}</strong>
          </div>
          <div class="summary-item">
            ${catBadgesHtml}
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">#</th>
              <th style="width: 95px;">Item Code</th>
              <th style="width: 160px;">Item Name</th>
              <th style="width: 110px;">Brand / Supplier</th>
              <th style="width: 85px;">Style / Lot</th>
              <th style="width: 90px;">Category</th>
              <th style="width: 50px; text-align: center;">UOM</th>
              <th style="width: 75px; text-align: right;">Rate (₹)</th>
              <th style="width: 65px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer-section">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-text">Prepared By (Store In-Charge)</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-text">Verified By (Inventory Auditor)</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-text">Authorized Signatory</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExportItemCodeReportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const title = "MH STORE - SYSTEM ITEM CODES MASTER REPORT";
      const dateStr = new Date().toLocaleDateString('en-GB') + " " + new Date().toLocaleTimeString('en-IN');

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text(title, 40, 36);

      doc.setFontSize(9);
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated On: ${dateStr}  |  Total Registered Items: ${filteredItemCodes.length}  |  Filter: ${icCategoryFilter === 'all' ? 'All Categories' : icCategoryFilter}`, 40, 52);

      const tableHeaders = [
        ["#", "Item Code", "Item Name", "Brand / Supplier", "Style / Lot", "Category", "UOM", "Rate (₹)", "Status"]
      ];

      const tableData = filteredItemCodes.map((ic, idx) => [
        idx + 1,
        ic.item_code || '—',
        ic.item_name || '—',
        ic.brand || 'General',
        ic.style || 'N/A',
        ic.category || 'Trims',
        ic.uom || 'PCS',
        `₹${fmtMoney(ic.rate || 0)}`,
        'Active'
      ]);

      autoTable(doc, {
        startY: 65,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8.5,
          cellPadding: 5,
          lineColor: [203, 213, 225],
          lineWidth: 0.3,
          textColor: [15, 23, 42],
          valign: 'middle'
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          lineColor: [15, 23, 42],
          lineWidth: 0.3
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 32 },
          1: { fontStyle: 'bold', cellWidth: 105 },
          2: { fontStyle: 'bold', cellWidth: 190 },
          3: { cellWidth: 110 },
          4: { cellWidth: 90 },
          5: { cellWidth: 95 },
          6: { halign: 'center', cellWidth: 50 },
          7: { halign: 'right', cellWidth: 75 },
          8: { halign: 'center', cellWidth: 60 }
        },
        didDrawPage: (data) => {
          const str = `Page ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 18);
        }
      });

      doc.save(`Item_Codes_Master_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Failed to export item codes PDF:", err);
      alert("Could not generate PDF: " + err.message);
    }
  };

  const handleExportItemCodeReportCSV = () => {
    try {
      const headers = ["Item Code", "Item Name", "Brand", "Style No", "Category / Dept", "UOM", "Rate (INR)", "Created Date"];
      const rowsData = filteredItemCodes.map(ic => [
        ic.item_code || '',
        ic.item_name || '',
        ic.brand || 'General',
        ic.style || 'N/A',
        ic.category || 'Trims',
        ic.uom || 'PCS',
        ic.rate || 0,
        ic.created_at ? new Date(ic.created_at).toISOString() : ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rowsData.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Item_Codes_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export item codes CSV:", err);
      alert("Could not export CSV: " + err.message);
    }
  };

  const mappedCount = dbItemCodes.filter(ic => ic.mt_code).length;
  const unmappedCount = dbItemCodes.length - mappedCount;

  return (
    <div className="ItemCodeGeneratorView" style={{ width: '100%', padding: '0 0 30px 0' }}>
      {/* Print styles for direct browser Ctrl+P */}
      <style>{`
        @media print {
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print, .Sidebar, .Header, .FilterSelect, .btn, .modal-overlay, form, nav, header {
            display: none !important;
          }
          .ItemCodeGeneratorView {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .panel {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9pt !important;
          }
          th, td {
            border: 1px solid #333 !important;
            padding: 4px 6px !important;
            color: #000 !important;
          }
          th {
            background: #f1f5f9 !important;
            color: #000 !important;
            font-weight: bold !important;
          }
        }
      `}</style>

      {/* Native App Page Header */}
      <div className="Header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className="Title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '24px', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
            <Tag size={28} style={{ color: 'var(--accent-color)' }} />
            Item Code Generator & Master Registry
          </h2>
          <p className="SubTitle" style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', margin: '4px 0 0 0' }}>
            Standardized ST00001 series registry with MT material mapping, tag conversion, and audit ledger tracking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Settings & MT Code Mapping Manager Button */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowMappingModal(true);
              fetchMappings();
            }}
            style={{
              height: '38px',
              borderRadius: '8px',
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)',
              border: 'none'
            }}
          >
            <Settings size={16} />
            <span>MT Code Mapping & Settings</span>
            {unmappedCount > 0 && (
              <span style={{
                background: 'rgba(255,255,255,0.25)',
                color: '#ffffff',
                padding: '1px 7px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '900'
              }}>
                {mappedCount}/{dbItemCodes.length}
              </span>
            )}
          </button>

          {/* Dedicated Print Page Button */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handlePrintItemCodesPage}
            style={{ height: '38px', borderRadius: '8px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: 'var(--accent-color, #4f46e5)', borderColor: 'var(--accent-color, #6366f1)', background: 'var(--accent-light, rgba(79, 70, 229, 0.08))' }}
            title="Open Clean Printable Document Page"
          >
            <Printer size={15} />
            <span>Print Page</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportItemCodeReportPDF}
            style={{ height: '38px', borderRadius: '8px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}
          >
            <FileText size={15} color="#dc2626" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportItemCodeReportCSV}
            style={{ height: '38px', borderRadius: '8px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}
          >
            <Download size={15} color="#059669" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchItemCodes}
            disabled={loadingItemCodes}
            style={{ height: '38px', borderRadius: '8px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}
          >
            <RefreshCw size={15} className={loadingItemCodes ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Item Code Creation Panel */}
      <div className="panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', marginBottom: '24px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={18} style={{ color: 'var(--accent-color)' }} />
            Generate New Item Code
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
              Series Format: <code>ST00001, ST00002, ...</code>
            </span>
            <span style={{ background: 'var(--accent-light, #e0e7ff)', color: 'var(--accent-color, #4f46e5)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', fontFamily: 'monospace' }}>
              Next Code: {generateUniqueItemCode()}
            </span>
          </div>
        </div>

        <form onSubmit={handleCreateItemCode}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                Item Name *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Satin Fabric Label, Metal Button 18L"
                value={icItemName}
                onChange={e => setIcItemName(e.target.value)}
                style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px' }}
                required
              />
            </div>

            <div>
              <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                Brand Name
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. BROOKS, PUMA, L.S, KAPIL"
                value={icBrand}
                onChange={e => setIcBrand(e.target.value)}
                style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px' }}
              />
            </div>

            <div>
              <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                Style No / Lot
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. SS26, ST-1004"
                value={icStyle}
                onChange={e => setIcStyle(e.target.value)}
                style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px' }}
              />
            </div>

            {/* Category Field with Dynamic Add Option */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="FormLabel" style={{ margin: 0, fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                  Category / Dept *
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCatDialog(true)}
                  style={{ fontSize: '11px', background: 'var(--accent-light, #e0e7ff)', color: 'var(--accent-color, #4f46e5)', border: 'none', borderRadius: '4px', padding: '2px 8px', fontWeight: '800', cursor: 'pointer' }}
                  title="Add new category"
                >
                  + Add
                </button>
              </div>
              <select
                className="form-input"
                value={icCategory}
                onChange={e => {
                  if (e.target.value === 'ADD_NEW') {
                    setShowAddCatDialog(true);
                  } else {
                    setIcCategory(e.target.value);
                  }
                }}
                style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px', backgroundColor: 'var(--bg-primary)' }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="ADD_NEW" style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>➕ Add New Category...</option>
              </select>
            </div>

            {/* UOM Field with Dynamic Add Option */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="FormLabel" style={{ margin: 0, fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                  Unit of Measure (UOM) *
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddUomDialog(true)}
                  style={{ fontSize: '11px', background: 'var(--accent-light, #e0e7ff)', color: 'var(--accent-color, #4f46e5)', border: 'none', borderRadius: '4px', padding: '2px 8px', fontWeight: '800', cursor: 'pointer' }}
                  title="Add new Unit of Measure"
                >
                  + Add
                </button>
              </div>
              <select
                className="form-input"
                value={icUom}
                onChange={e => {
                  if (e.target.value === 'ADD_NEW') {
                    setShowAddUomDialog(true);
                  } else {
                    setIcUom(e.target.value);
                  }
                }}
                style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px', backgroundColor: 'var(--bg-primary)' }}
              >
                {uoms.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
                <option value="ADD_NEW" style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>➕ Add New UOM...</option>
              </select>
            </div>

            <div>
              <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                Warehouse MT Code (Optional)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. MT1072"
                value={icMtCode}
                onChange={e => setIcMtCode(e.target.value)}
                style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                Estimated Rate (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                placeholder="0.00"
                value={icRate}
                onChange={e => setIcRate(e.target.value)}
                style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ height: '40px', padding: '0 24px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Sparkles size={16} />
              <span>Create Item Code</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: System Item Codes Master Registry Table Panel */}
      <div className="panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} style={{ color: 'var(--accent-color)' }} />
              System Item Codes Master Registry
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
              Showing {filteredItemCodes.length} registered item codes
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="FilterSelect"
              value={icCategoryFilter}
              onChange={e => setIcCategoryFilter(e.target.value)}
              style={{ height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12.5px', padding: '0 10px', fontWeight: '600', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)', minWidth: '150px' }}
            >
              <option value="all">📁 All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <div style={{ position: 'relative', width: '280px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <Search size={15} />
              </span>
              <input
                type="text"
                className="form-input"
                placeholder="Search Item Code, Name, Brand, Style..."
                value={icSearchQuery}
                onChange={e => setIcSearchQuery(e.target.value)}
                style={{ paddingLeft: '34px', width: '100%', borderRadius: '8px', height: '38px', fontSize: '12.5px' }}
              />
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-main)', textAlign: 'left', fontWeight: '700' }}>
                <th style={{ padding: '12px 10px', width: '40px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '12px 10px', width: '130px' }}>Item Code</th>
                <th style={{ padding: '12px 10px' }}>Item Name</th>
                <th style={{ padding: '12px 10px', width: '130px' }}>Brand</th>
                <th style={{ padding: '12px 10px', width: '120px' }}>Style / Lot</th>
                <th style={{ padding: '12px 10px', width: '120px' }}>Category</th>
                <th style={{ padding: '12px 10px', width: '70px', textAlign: 'center' }}>UOM</th>
                <th style={{ padding: '12px 10px', width: '90px', textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ padding: '12px 10px', width: '160px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItemCodes.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}>No Item Codes registered</div>
                    <div style={{ fontSize: '12px' }}>Use the form above to add new item codes or click "MT Code Mapping & Settings" to import!</div>
                  </td>
                </tr>
              ) : (
                filteredItemCodes.map((ic, idx) => (
                  <tr key={ic.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>{idx + 1}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ background: 'var(--accent-light, #e0e7ff)', color: 'var(--accent-color, #4f46e5)', padding: '3px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '12px', fontFamily: 'monospace' }}>
                        {ic.item_code}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', fontWeight: '700', color: 'var(--text-main)' }}>{ic.item_name}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-main)' }}>{ic.brand || 'General'}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{ic.style || 'N/A'}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '600', border: '1px solid var(--border-color)' }}>
                        {ic.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{ic.uom || 'PCS'}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>₹{fmtMoney(ic.rate || 0)}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenLedgerModal(ic)}
                          style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="View Movement & PO Ledger History"
                        >
                          <History size={12} color="var(--accent-color)" />
                          <span>Ledger</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEditModal(ic)}
                          style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#2563eb' }}
                          title="Edit Item Code Details"
                        >
                          <Pencil size={12} color="#2563eb" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setShowMappingModal(true);
                            setMappingSearchQuery(ic.item_code);
                            fetchMappings();
                          }}
                          style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Map / Edit MT Code"
                        >
                          <Link2 size={12} color="#059669" />
                          <span>Map</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDeleteItemCode(ic.id, ic.item_code)}
                          style={{ padding: '4px 6px', borderRadius: '6px', color: 'var(--danger)' }}
                          title="Delete Item Code"
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

      {/* ── MODAL: MT Code Mapping & Settings Manager ──────────────────────── */}
      {showMappingModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '1050px', width: '96%', borderRadius: '20px', padding: '26px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'var(--accent-light, #e0e7ff)', padding: '8px', borderRadius: '10px', color: 'var(--accent-color, #4f46e5)' }}>
                    <Settings size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: 'var(--text-main)' }}>
                      Item Code (ST) ⇄ Warehouse MT Code Settings & Mapping
                    </h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      Link standard ST00001 series item codes with warehouse MT materials for barcode lookups, tag conversion, and stock synchronization.
                    </p>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowMappingModal(false)}
                style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Action Feedback Banner */}
            {mappingActionStatus && (
              <div style={{
                background: mappingActionStatus.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1.5px solid ${mappingActionStatus.type === 'success' ? '#10b981' : '#ef4444'}`,
                borderRadius: '12px',
                padding: '10px 16px',
                marginBottom: '16px',
                fontSize: '13px',
                fontWeight: '700',
                color: mappingActionStatus.type === 'success' ? '#047857' : '#b91c1c',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {mappingActionStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span>{mappingActionStatus.msg}</span>
              </div>
            )}

            {/* Top Quick Action & Automation Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              {/* Card 1: Generate / Sync Tags into ST00094+ */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(59, 130, 246, 0.08) 100%)',
                border: '1.5px solid rgba(79, 70, 229, 0.3)',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: 'var(--accent-color, #4f46e5)', fontSize: '13.5px', marginBottom: '4px' }}>
                    <Zap size={16} />
                    <span>⚡ Generate Tags into ST00094+ Series</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Converts all warehouse Tag MT codes (<code>MT1072</code>–<code>MT1128</code>) into sequential <code>ST00094</code>+ item codes preserving name, brand, category, UOM, and pieces.
                  </div>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleGenerateTagsFromMt}
                    disabled={loadingMappings}
                    style={{
                      borderRadius: '8px',
                      fontWeight: '800',
                      fontSize: '12px',
                      padding: '0 14px',
                      height: '34px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Sparkles size={14} />
                    <span>Generate / Sync All Tags</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Generate / Sync Patch & Tapes into ST00141+ */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.06) 0%, rgba(217, 70, 239, 0.08) 100%)',
                border: '1.5px solid rgba(236, 72, 153, 0.3)',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#db2777', fontSize: '13.5px', marginBottom: '4px' }}>
                    <Zap size={16} />
                    <span>⚡ Generate Patch & Tapes (ST00141+)</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Converts all warehouse Patch & Tapes MT codes (<code>MT1129</code>–<code>MT1333</code>) into sequential ST codes preserving name, brand, category, and UOM.
                  </div>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleGeneratePatchTapesFromMt}
                    disabled={loadingMappings}
                    style={{
                      borderRadius: '8px',
                      fontWeight: '800',
                      fontSize: '12px',
                      padding: '0 14px',
                      height: '34px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #ec4899 0%, #d946ef 100%)',
                      borderColor: '#db2777'
                    }}
                  >
                    <Sparkles size={14} />
                    <span>Generate / Sync Patch & Tapes</span>
                  </button>
                </div>
              </div>

              {/* Card 3: Smart Auto-Map Remaining Materials */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(5, 150, 105, 0.08) 100%)',
                border: '1.5px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#059669', fontSize: '13.5px', marginBottom: '4px' }}>
                    <RefreshCw size={16} />
                    <span>🔄 Smart Auto-Map All Materials</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Scans warehouse items and automatically links them with Item Codes whenever material name, brand, or category match.
                  </div>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAutoMapAll}
                    disabled={loadingMappings}
                    style={{
                      borderRadius: '8px',
                      fontWeight: '800',
                      fontSize: '12px',
                      padding: '0 14px',
                      height: '34px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderColor: '#10b981',
                      color: '#059669'
                    }}
                  >
                    <RefreshCw size={14} className={loadingMappings ? 'spin' : ''} />
                    <span>Run Smart Auto-Map</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Metrics & Tabs Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setMappingTab('mappings')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    background: mappingTab === 'mappings' ? 'var(--accent-color, #4f46e5)' : 'var(--bg-secondary)',
                    color: mappingTab === 'mappings' ? '#ffffff' : 'var(--text-main)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Link2 size={14} />
                  <span>Item Codes ⇄ MT Codes</span>
                  <span style={{
                    background: mappingTab === 'mappings' ? 'rgba(255,255,255,0.25)' : 'var(--border-color)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '11px'
                  }}>
                    {mappingData.mappings?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMappingTab('unlinked')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    background: mappingTab === 'unlinked' ? 'var(--accent-color, #4f46e5)' : 'var(--bg-secondary)',
                    color: mappingTab === 'unlinked' ? '#ffffff' : 'var(--text-main)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Unlink size={14} />
                  <span>Unlinked Warehouse Materials</span>
                  <span style={{
                    background: mappingTab === 'unlinked' ? 'rgba(255,255,255,0.25)' : 'rgba(239, 68, 68, 0.15)',
                    color: mappingTab === 'unlinked' ? '#ffffff' : '#dc2626',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: '800'
                  }}>
                    {mappingData.unlinkedWc?.length || 0}
                  </span>
                </button>
              </div>

              {/* Search & Status Filter */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {mappingTab === 'mappings' && (
                  <select
                    className="FilterSelect"
                    value={mappingFilter}
                    onChange={e => setMappingFilter(e.target.value)}
                    style={{ height: '36px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', padding: '0 8px', fontWeight: '600', backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="mapped">✅ Mapped Only</option>
                    <option value="unmapped">⚠️ Unmapped Only</option>
                  </select>
                )}

                <div style={{ position: 'relative', width: '220px' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search codes, names..."
                    value={mappingSearchQuery}
                    onChange={e => setMappingSearchQuery(e.target.value)}
                    style={{ paddingLeft: '30px', width: '100%', borderRadius: '8px', height: '36px', fontSize: '12px' }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Table Container */}
            <div style={{ flex: 1, overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)', maxHeight: '420px' }}>
              {loadingMappings ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
                  <div>Loading mapping data...</div>
                </div>
              ) : mappingTab === 'mappings' ? (
                /* TAB 1: Item Codes ⇄ MT Codes Table */
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)' }}>
                    <tr style={{ borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-main)', textAlign: 'left', fontWeight: '700' }}>
                      <th style={{ padding: '10px', width: '35px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '10px', width: '110px' }}>Item Code (ST)</th>
                      <th style={{ padding: '10px', width: '160px' }}>Mapped MT Code</th>
                      <th style={{ padding: '10px' }}>Item Name</th>
                      <th style={{ padding: '10px', width: '110px' }}>Brand</th>
                      <th style={{ padding: '10px', width: '90px' }}>Category</th>
                      <th style={{ padding: '10px', width: '60px', textAlign: 'center' }}>UOM</th>
                      <th style={{ padding: '10px', width: '80px', textAlign: 'right' }}>Stock Pcs</th>
                      <th style={{ padding: '10px', width: '110px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMappings.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No matching item code mappings found.
                        </td>
                      </tr>
                    ) : (
                      filteredMappings.map((m, idx) => {
                        const currentMt = editingMapping[m.item_code] !== undefined ? editingMapping[m.item_code] : (m.mt_code || '');
                        const isSaving = savingMappingCode === m.item_code;
                        return (
                          <tr key={m.id || idx} style={{ borderBottom: '1px solid var(--border-color)', background: m.isMapped ? 'transparent' : 'rgba(251, 191, 36, 0.04)' }}>
                            <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ padding: '10px' }}>
                              <span style={{ background: 'var(--accent-light, #e0e7ff)', color: 'var(--accent-color, #4f46e5)', padding: '3px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '11.5px', fontFamily: 'monospace' }}>
                                {m.item_code}
                              </span>
                            </td>
                            <td style={{ padding: '10px' }}>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="e.g. MT1072"
                                  value={currentMt}
                                  onChange={e => setEditingMapping({ ...editingMapping, [m.item_code]: e.target.value.toUpperCase() })}
                                  style={{
                                    width: '100px',
                                    height: '30px',
                                    padding: '0 6px',
                                    fontSize: '11.5px',
                                    fontFamily: 'monospace',
                                    fontWeight: '700',
                                    borderRadius: '6px',
                                    border: currentMt ? '1px solid #10b981' : '1px dashed var(--border-color)',
                                    background: currentMt ? '#ecfdf5' : 'var(--bg-primary)',
                                    color: currentMt ? '#047857' : 'var(--text-main)'
                                  }}
                                />
                                {currentMt !== (m.mt_code || '') && (
                                  <button
                                    type="button"
                                    onClick={() => handleSaveSingleMapping(m.item_code, currentMt)}
                                    disabled={isSaving}
                                    style={{
                                      background: '#10b981',
                                      color: '#ffffff',
                                      border: 'none',
                                      borderRadius: '6px',
                                      padding: '4px 8px',
                                      fontSize: '11px',
                                      fontWeight: '800',
                                      cursor: 'pointer'
                                    }}
                                    title="Save new mapping"
                                  >
                                    Save
                                  </button>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>{m.item_name}</td>
                            <td style={{ padding: '10px', color: 'var(--text-main)' }}>{m.brand || 'General'}</td>
                            <td style={{ padding: '10px' }}>
                              <span style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                                {m.category}
                              </span>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>{m.uom || 'PCS'}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: m.pieces > 0 ? '#059669' : 'var(--text-muted)' }}>
                              {m.pieces ? m.pieces.toLocaleString() : '—'}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              {m.mt_code ? (
                                <button
                                  type="button"
                                  onClick={() => handleSaveSingleMapping(m.item_code, '')}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#dc2626',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title="Unlink this MT Code"
                                >
                                  <Unlink size={12} />
                                  <span>Unlink</span>
                                </button>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '700' }}>⚠️ Unlinked</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ) : (
                /* TAB 2: Unlinked Warehouse Materials Table */
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)' }}>
                    <tr style={{ borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-main)', textAlign: 'left', fontWeight: '700' }}>
                      <th style={{ padding: '10px', width: '35px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '10px', width: '110px' }}>Warehouse MT</th>
                      <th style={{ padding: '10px' }}>Material Name</th>
                      <th style={{ padding: '10px', width: '120px' }}>Supplier / Brand</th>
                      <th style={{ padding: '10px', width: '100px' }}>Category</th>
                      <th style={{ padding: '10px', width: '60px', textAlign: 'center' }}>Unit</th>
                      <th style={{ padding: '10px', width: '80px', textAlign: 'right' }}>Pieces</th>
                      <th style={{ padding: '10px', width: '120px' }}>Store Location</th>
                      <th style={{ padding: '10px', width: '140px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnlinkedWc.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ padding: '30px', textAlign: 'center', color: '#059669', fontWeight: '700' }}>
                          🎉 All warehouse materials are mapped to Item Codes!
                        </td>
                      </tr>
                    ) : (
                      filteredUnlinkedWc.map((w, idx) => (
                        <tr key={w.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '10px' }}>
                            <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '11.5px', fontFamily: 'monospace' }}>
                              {w.mt_code}
                            </span>
                          </td>
                          <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>{w.item_name}</td>
                          <td style={{ padding: '10px', color: 'var(--text-main)' }}>{w.brand || 'General'}</td>
                          <td style={{ padding: '10px' }}>
                            <span style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                              {w.category}
                            </span>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>{w.uom || 'PCS'}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>
                            {w.pieces ? w.pieces.toLocaleString() : '0'}
                          </td>
                          <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '11.5px' }}>{w.storeLocation || 'Main Store'}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleQuickCreateSTForUnlinkedMt(w)}
                              style={{
                                background: 'var(--accent-light, #e0e7ff)',
                                color: 'var(--accent-color, #4f46e5)',
                                border: '1px solid var(--accent-color, #6366f1)',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Create new ST Item Code and link immediately"
                            >
                              <Sparkles size={12} />
                              <span>+ Create ST Code</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                💡 Tip: Mapped MT codes sync directly with barcode stickers and stock inwards.
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setShowMappingModal(false)}
                style={{ borderRadius: '8px', padding: '0 20px', height: '38px', fontWeight: '700' }}
              >
                Done & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 0: Duplicate Item Warning */}
      {duplicateWarning && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: '480px', borderRadius: '20px', padding: '28px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)', margin: '0 0 8px 0' }}>
              Item Already Exists!
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              An item with the same <strong>Name</strong>, <strong>Brand</strong>, <strong>Category</strong>, and <strong>Unit</strong> is already registered in the system.
            </p>
            <div style={{ background: 'rgba(251, 191, 36, 0.12)', border: '1.5px solid rgba(251, 191, 36, 0.5)', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>Existing Entry</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Item Code:</span>
                  <span style={{ background: 'var(--accent-light, #e0e7ff)', color: 'var(--accent-color, #4f46e5)', padding: '2px 10px', borderRadius: '6px', fontWeight: '900', fontFamily: 'monospace', fontSize: '13px' }}>
                    {duplicateWarning.existingItem.item_code}
                  </span>
                </div>
                {duplicateWarning.existingItem.mt_code && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>MT Code:</span>
                    <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', fontFamily: 'monospace', fontSize: '12px' }}>
                      {duplicateWarning.existingItem.mt_code}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Item Name:</span>
                  <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>{duplicateWarning.existingItem.item_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Brand:</span>
                  <span style={{ fontWeight: '700' }}>{duplicateWarning.existingItem.brand || 'General'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Category:</span>
                  <span style={{ fontWeight: '700' }}>{duplicateWarning.existingItem.category}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Unit (UOM):</span>
                  <span style={{ fontWeight: '700' }}>{duplicateWarning.existingItem.uom}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDuplicateWarning(null)}
                style={{ flex: 1, borderRadius: '10px', height: '42px', fontWeight: '700' }}
              >
                ← Go Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  navigator.clipboard.writeText(duplicateWarning.existingItem.item_code);
                  setDuplicateWarning(null);
                }}
                style={{ flex: 1, borderRadius: '10px', height: '42px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Copy size={15} /> Copy Existing Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Created Item Code Popup Window */}
      {createdItemCodePopup && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: '440px', borderRadius: '20px', padding: '24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🎉 Item Code Generated
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCreatedItemCodePopup(null)}
                style={{ borderRadius: '50%', padding: '6px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ background: 'var(--accent-light, #e0e7ff)', borderRadius: '16px', padding: '16px', marginBottom: '16px', border: '1.5px solid var(--accent-color, #6366f1)' }}>
              <div style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>GENERATED ITEM CODE</div>
              <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--accent-color)', letterSpacing: '0.04em' }}>
                {createdItemCodePopup.item_code}
              </div>
              {createdItemCodePopup.mt_code && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#047857', fontWeight: '800' }}>
                  Mapped MT: {createdItemCodePopup.mt_code}
                </div>
              )}
            </div>

            {createdItemCodePopup.qrDataUrl && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <img src={createdItemCodePopup.qrDataUrl} alt="Item Code Barcode" style={{ width: '150px', height: '150px', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '6px', background: '#fff' }} />
              </div>
            )}

            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '12px', textAlign: 'left', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
              <div><strong>Item Name:</strong> {createdItemCodePopup.item_name}</div>
              <div><strong>Brand:</strong> {createdItemCodePopup.brand}</div>
              <div><strong>Style:</strong> {createdItemCodePopup.style}</div>
              <div><strong>Category / Dept:</strong> {createdItemCodePopup.category}</div>
              <div><strong>UOM / Rate:</strong> {createdItemCodePopup.uom} (₹{fmtMoney(createdItemCodePopup.rate)})</div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(createdItemCodePopup.item_code);
                  setCopyFeedback(true);
                  setTimeout(() => setCopyFeedback(false), 2000);
                }}
                style={{ flex: 1, borderRadius: '10px', height: '40px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {copyFeedback ? <Check size={16} /> : <FileText size={16} />}
                <span>{copyFeedback ? 'Copied!' : 'Copy Code'}</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCreatedItemCodePopup(null)}
                style={{ flex: 1, borderRadius: '10px', height: '40px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Movement Ledger / Audit History Modal */}
      {selectedLedgerItem && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: '900px', width: '95%', borderRadius: '20px', padding: '24px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ background: 'var(--accent-light, #e0e7ff)', color: 'var(--accent-color, #4f46e5)', padding: '4px 10px', borderRadius: '6px', fontWeight: '900', fontSize: '14px', fontFamily: 'monospace' }}>
                    {selectedLedgerItem.item_code}
                  </span>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                    {selectedLedgerItem.item_name}
                  </h3>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Brand: {selectedLedgerItem.brand || 'General'} | Category: {selectedLedgerItem.category} | Style: {selectedLedgerItem.style || 'N/A'} {selectedLedgerItem.mt_code ? `| MT Code: ${selectedLedgerItem.mt_code}` : ''}
                </div>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedLedgerItem(null)}
                style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Ledger Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#059669', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <ArrowDownRight size={14} /> Total Received (Inward)
                </div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#059669', marginTop: '4px' }}>
                  {ledgerStats.inwardTotal.toLocaleString()} {selectedLedgerItem.uom || 'PCS'}
                </div>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <ArrowUpRight size={14} /> Total Issued (Outward)
                </div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626', marginTop: '4px' }}>
                  {ledgerStats.outwardTotal.toLocaleString()} {selectedLedgerItem.uom || 'PCS'}
                </div>
              </div>

              <div style={{ background: 'var(--accent-light, #e0e7ff)', border: '1px solid var(--accent-color, #6366f1)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--accent-color)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Box size={14} /> Current Stock Balance
                </div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--accent-color)', marginTop: '4px' }}>
                  {ledgerStats.balance.toLocaleString()} {selectedLedgerItem.uom || 'PCS'}
                </div>
              </div>
            </div>

            {/* Audit History Table */}
            <div style={{ maxHeight: '380px', overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              {loadingLedger ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={20} className="spin" style={{ marginBottom: '6px' }} />
                  <div>Loading item code movement history...</div>
                </div>
              ) : ledgerLogs.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}>No movement transactions logged yet</div>
                  <div style={{ fontSize: '12px' }}>Material inward and outward transactions for this item code will appear here.</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-main)', textAlign: 'left', fontWeight: '700' }}>
                      <th style={{ padding: '10px', width: '35px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '10px' }}>Date & Time</th>
                      <th style={{ padding: '10px', width: '90px', textAlign: 'center' }}>Type</th>
                      <th style={{ padding: '10px' }}>PO Number</th>
                      <th style={{ padding: '10px' }}>Lot No / Dept</th>
                      <th style={{ padding: '10px' }}>Supplier / Receiver</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Qty</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Net Wt (kg)</th>
                      <th style={{ padding: '10px' }}>Person</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerLogs.map((log, idx) => {
                      const isInward = (log.transaction_type || '').toUpperCase() === 'INWARD';
                      const isReturn = (log.transaction_type || '').toUpperCase() === 'RETURN';
                      return (
                        <tr key={log.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                            {log.created_at ? new Date(log.created_at).toLocaleDateString('en-GB') + ' ' + new Date(log.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {isInward ? (
                              <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                                📥 INWARD
                              </span>
                            ) : isReturn ? (
                              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                                🔄 RETURN
                              </span>
                            ) : (
                              <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                                📤 OUTWARD
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>{log.po_number || 'N/A'}</td>
                          <td style={{ padding: '10px' }}>{log.lot_no || 'N/A'}</td>
                          <td style={{ padding: '10px' }}>{log.supplier_name || 'N/A'}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: isInward || isReturn ? '#059669' : '#dc2626' }}>
                            {isInward || isReturn ? `+${log.qty}` : `-${log.qty}`} {log.uom || 'PCS'}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>{log.net_wt ? `${parseFloat(log.net_wt).toFixed(2)} kg` : '—'}</td>
                          <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{log.person_name || 'System'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedLedgerItem(null)} style={{ borderRadius: '8px' }}>
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Manage & Add Categories */}
      {showAddCatDialog && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: '450px', borderRadius: '16px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title" style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                Manage & Add Categories / Departments
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddCatDialog(false)} style={{ borderRadius: '50%', padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 0' }}>
              <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700' }}>
                New Category Name *
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Buttons, Fusing, Polybags..."
                  value={newCatInput}
                  onChange={e => setNewCatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
                  style={{ flex: 1, borderRadius: '8px', padding: '8px 12px' }}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleAddCategory()}
                  disabled={!newCatInput.trim()}
                  style={{ borderRadius: '8px', fontWeight: '700', padding: '0 16px' }}
                >
                  Add
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
                  Available Categories ({categories.length})
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                  {categories.map(cat => {
                    const isCustom = customCategories.includes(cat) && !DEFAULT_CATEGORIES.includes(cat);
                    return (
                      <span
                        key={cat}
                        style={{
                          fontSize: '11.5px',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: '600'
                        }}
                      >
                        {cat}
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex' }}
                            title={`Remove custom category ${cat}`}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddCatDialog(false)} style={{ borderRadius: '8px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Manage & Add Units of Measure (UOM) */}
      {showAddUomDialog && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: '450px', borderRadius: '16px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title" style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                Manage & Add Units of Measure (UOM)
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddUomDialog(false)} style={{ borderRadius: '50%', padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 0' }}>
              <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700' }}>
                New Unit of Measure Code *
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. BUNDLE, THREAD_CONE, CONTAINER..."
                  value={newUomInput}
                  onChange={e => setNewUomInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddUom(); }}
                  style={{ flex: 1, borderRadius: '8px', padding: '8px 12px' }}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleAddUom()}
                  disabled={!newUomInput.trim()}
                  style={{ borderRadius: '8px', fontWeight: '700', padding: '0 16px' }}
                >
                  Add
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
                  Available Units of Measure ({uoms.length})
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                  {uoms.map(u => {
                    const isCustom = customUoms.includes(u) && !DEFAULT_UOMS.includes(u);
                    return (
                      <span
                        key={u}
                        style={{
                          fontSize: '11.5px',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: '600'
                        }}
                      >
                        {u}
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUom(u)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex' }}
                            title={`Remove custom UOM ${u}`}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddUomDialog(false)} style={{ borderRadius: '8px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Edit Item Code Details */}
      {showEditModal && editingItem && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '650px', width: '95%', borderRadius: '20px', padding: '26px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', padding: '10px', borderRadius: '12px', display: 'flex' }}>
                  <Pencil size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Edit Item Code:</span>
                    <span style={{ background: 'var(--accent-light, #e0e7ff)', color: 'var(--accent-color, #4f46e5)', padding: '2px 8px', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace' }}>
                      {editForm.item_code}
                    </span>
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                    Update item description, supplier brand, style/lot, category, UOM, rate, and linked MT code.
                  </span>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowEditModal(false)}
                style={{ borderRadius: '50%', padding: '6px', border: 'none' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditItem}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                    System Item Code *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.item_code}
                    onChange={e => setEditForm(prev => ({ ...prev, item_code: e.target.value.toUpperCase() }))}
                    required
                    style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px', fontFamily: 'monospace', fontWeight: '700', letterSpacing: '0.05em' }}
                  />
                </div>

                <div>
                  <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                    Linked Warehouse MT Code
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. MT1129 (or leave blank)"
                    value={editForm.mt_code}
                    onChange={e => setEditForm(prev => ({ ...prev, mt_code: e.target.value.toUpperCase() }))}
                    style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px', fontFamily: 'monospace', color: '#047857', fontWeight: '700' }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                    Item Name *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.item_name}
                    onChange={e => setEditForm(prev => ({ ...prev, item_name: e.target.value }))}
                    required
                    placeholder="e.g. BALENCIAGA, TAPE 2INCH, SILICON PATCH"
                    style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px', fontWeight: '600' }}
                  />
                </div>

                <div>
                  <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                    Brand / Supplier
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. KAPIL, JASKIRAT, M.T"
                    value={editForm.brand}
                    onChange={e => setEditForm(prev => ({ ...prev, brand: e.target.value }))}
                    style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px' }}
                  />
                </div>

                <div>
                  <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                    Style / Lot Number
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. N/A or Lot #102"
                    value={editForm.style}
                    onChange={e => setEditForm(prev => ({ ...prev, style: e.target.value }))}
                    style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="FormLabel" style={{ fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCatDialog(true)}
                      style={{ fontSize: '11px', background: 'var(--accent-light, #e0e7ff)', color: 'var(--accent-color, #4f46e5)', border: 'none', borderRadius: '4px', padding: '2px 8px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      + New
                    </button>
                  </div>
                  <select
                    className="form-input"
                    value={editForm.category}
                    onChange={e => {
                      if (e.target.value === 'ADD_NEW') setShowAddCatDialog(true);
                      else setEditForm(prev => ({ ...prev, category: e.target.value }));
                    }}
                    style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px', backgroundColor: 'var(--bg-primary)' }}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="ADD_NEW" style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>➕ Add New Category...</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="FormLabel" style={{ fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                      Unit of Measure (UOM) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddUomDialog(true)}
                      style={{ fontSize: '11px', background: 'var(--accent-light, #e0e7ff)', color: 'var(--accent-color, #4f46e5)', border: 'none', borderRadius: '4px', padding: '2px 8px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      + New
                    </button>
                  </div>
                  <select
                    className="form-input"
                    value={editForm.uom}
                    onChange={e => {
                      if (e.target.value === 'ADD_NEW') setShowAddUomDialog(true);
                      else setEditForm(prev => ({ ...prev, uom: e.target.value }));
                    }}
                    style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px', backgroundColor: 'var(--bg-primary)' }}
                  >
                    {uoms.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    <option value="ADD_NEW" style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>➕ Add New UOM...</option>
                  </select>
                </div>

                <div>
                  <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                    Rate (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    value={editForm.rate}
                    onChange={e => setEditForm(prev => ({ ...prev, rate: e.target.value }))}
                    style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSavingEdit}
                  style={{ borderRadius: '8px', padding: '0 18px', height: '40px', fontWeight: '700' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSavingEdit}
                  style={{ borderRadius: '8px', padding: '0 24px', height: '40px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#2563eb', borderColor: '#2563eb' }}
                >
                  <Check size={16} />
                  <span>{isSavingEdit ? 'Saving Changes...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
