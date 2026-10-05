import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Tag, PlusCircle, Search, RefreshCw, Download, FileText,
  Trash2, X, Check, QrCode, Filter, Sparkles, Layers, Box, CheckCircle2, Copy, History, ArrowDownRight, ArrowUpRight, RotateCcw
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBackendUrl } from '../utils/api';

// Local storage helper helpers
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
  'Trims', 'Fabric', 'Packaging', 'Accessories', 'Labels', 'Thread', 'Dori', 'Zip', 'Elastic', 'Bone'
];

const DEFAULT_UOMS = [
  'PCS', 'MTR', 'KG', 'PKT', 'GROSS', 'ROLL', 'SET', 'BOX', 'PAIR', 'YARD', 'DOZEN'
];

export default function ItemCodeGeneratorView() {
  const [dbItemCodes, setDbItemCodes] = useState(() =>
    getLocalStorageItem('po_saved_item_codes', [])
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

  const [loadingItemCodes, setLoadingItemCodes] = useState(false);
  const [icItemName, setIcItemName] = useState('');
  const [icBrand, setIcBrand] = useState('');
  const [icStyle, setIcStyle] = useState('');
  const [icCategory, setIcCategory] = useState('Trims');
  const [icUom, setIcUom] = useState('PCS');
  const [icRate, setIcRate] = useState('');
  const [icSearchQuery, setIcSearchQuery] = useState('');
  const [icCategoryFilter, setIcCategoryFilter] = useState('all');
  const [createdItemCodePopup, setCreatedItemCodePopup] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { existingItem } when duplicate found
  const [filteredItemCodes, setFilteredItemCodes] = useState([]);

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

  // Fetch Item Codes from MySQL Database
  const fetchItemCodes = useCallback(async () => {
    try {
      setLoadingItemCodes(true);
      const res = await fetch(`${getBackendUrl()}/api/item-codes`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.itemCodes)) {
          setDbItemCodes(data.itemCodes);
          setLocalStorageItem('po_saved_item_codes', data.itemCodes);
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch item codes from DB:", err);
    } finally {
      setLoadingItemCodes(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItemCodes();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchItemCodes]);

  const generateUniqueItemCode = () => {
    let maxSeq = 0;
    dbItemCodes.forEach(ic => {
      const code = String(ic.item_code || '').trim();
      if (/^ST\d{5}$/i.test(code)) {
        const num = parseInt(code.slice(2), 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(5, '0');
    return `ST${nextSeq}`;
  };

  const handleCreateItemCode = async (e) => {
    if (e) e.preventDefault();
    if (!icItemName.trim()) {
      alert("Please enter Item Name.");
      return;
    }

    // ── Duplicate Detection: block if item_name + brand + category + uom all match ──
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
    // ────────────────────────────────────────────────────────────────────────────────

    const generatedCode = generateUniqueItemCode();
    const newRecord = {
      item_code: generatedCode,
      item_name: icItemName.trim(),
      brand: icBrand.trim() || 'General',
      style: icStyle.trim() || 'N/A',
      category: icCategory || 'Trims',
      uom: icUom || 'PCS',
      rate: parseFloat(icRate) || 0,
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

  // Search/filter logic — uses useEffect to guarantee re-evaluation whenever
  // dbItemCodes, query, or category filter change (avoids stale-closure in useMemo).
  useEffect(() => {
    const q = icSearchQuery.toLowerCase().trim();
    const result = dbItemCodes.filter(item => {
      const matchesCat = icCategoryFilter === 'all' || (item.category || '').toLowerCase() === icCategoryFilter.toLowerCase();
      let matchesQ = true;
      if (q) {
        const code = (item.item_code || '').toLowerCase();
        const name = (item.item_name || '').toLowerCase();
        const brand = (item.brand || '').toLowerCase();
        const style = (item.style || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const uom = (item.uom || '').toLowerCase();
        matchesQ = code.includes(q) || name.includes(q) || brand.includes(q) || style.includes(q) || cat.includes(q) || uom.includes(q);
      }
      return matchesCat && matchesQ;
    });
    setFilteredItemCodes(result);
  }, [dbItemCodes, icSearchQuery, icCategoryFilter]);

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

  const handleExportItemCodeReportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const title = "SYSTEM ITEM CODES MASTER REPORT";
      const dateStr = new Date().toLocaleDateString('en-GB') + " " + new Date().toLocaleTimeString();

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text(title, 40, 40);

      doc.setFontSize(9);
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated On: ${dateStr}  |  Total Items: ${filteredItemCodes.length}`, 40, 56);

      const tableHeaders = [
        ["#", "Item Code", "Item Name", "Brand", "Style No.", "Category / Dept", "UOM", "Rate (₹)", "Created Date"]
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
        ic.created_at ? new Date(ic.created_at).toLocaleDateString('en-GB') : '—'
      ]);

      autoTable(doc, {
        startY: 70,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8.5,
          cellPadding: 6,
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          textColor: [15, 23, 42],
          valign: 'middle'
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          lineColor: [0, 0, 0],
          lineWidth: 0.25
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 30 },
          1: { fontStyle: 'bold', cellWidth: 110 },
          2: { fontStyle: 'bold', cellWidth: 160 },
          3: { cellWidth: 90 },
          4: { cellWidth: 80 },
          5: { cellWidth: 90 },
          6: { halign: 'center', cellWidth: 45 },
          7: { halign: 'right', cellWidth: 65 },
          8: { halign: 'center', cellWidth: 70 }
        },
        didDrawPage: (data) => {
          const str = `Page ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 20);
        }
      });

      doc.save(`Item_Codes_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
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
        ic.brand || '',
        ic.style || '',
        ic.category || '',
        ic.uom || '',
        ic.rate || 0,
        ic.created_at || ''
      ]);

      const csvContent = [
        headers.map(h => `"${h}"`).join(","),
        ...rowsData.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Item_Codes_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export item codes CSV:", err);
      alert("Could not export CSV: " + err.message);
    }
  };

  return (
    <div className="ItemCodeGeneratorView" style={{ width: '100%', padding: '0 0 30px 0' }}>
      {/* Native App Page Header */}
      <div className="Header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className="Title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '24px', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
            <Tag size={28} style={{ color: 'var(--accent-color)' }} />
            Item Code Generator & Master Registry
          </h2>
          <p className="SubTitle" style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', margin: '4px 0 0 0' }}>
            Create standardized, auto-sequenced item codes (ST00001 series) with movement audit ledger tracking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={18} style={{ color: 'var(--accent-color)' }} />
            Generate New Item Code
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
              Series Format: <code>ST00001, ST00002, ...</code>
            </span>
            <span style={{ background: 'var(--accent-light, #e0e7ff)', color: 'var(--accent-color, #4f46e5)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', fontFamily: 'monospace' }}>
              Next Code: {generateUniqueItemCode()}
            </span>
          </div>
        </div>

        <form onSubmit={handleCreateItemCode}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
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
                placeholder="e.g. BROOKS, PUMA, MH STORE"
                value={icBrand}
                onChange={e => setIcBrand(e.target.value)}
                style={{ width: '100%', borderRadius: '8px', height: '40px', padding: '0 12px' }}
              />
            </div>

            <div>
              <label className="FormLabel" style={{ display: 'block', marginBottom: '6px', fontWeight: '700', fontSize: '12.5px', color: 'var(--text-main)' }}>
                Style No / Code
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
                  Category / Department *
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
              Showing {filteredItemCodes.length} registered item code entries
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
                placeholder="Search by Item Code, Name, Brand, Style..."
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
                <th style={{ padding: '12px 10px', width: '120px' }}>Brand</th>
                <th style={{ padding: '12px 10px', width: '110px' }}>Style No.</th>
                <th style={{ padding: '12px 10px', width: '120px' }}>Category</th>
                <th style={{ padding: '12px 10px', width: '70px', textAlign: 'center' }}>UOM</th>
                <th style={{ padding: '12px 10px', width: '90px', textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ padding: '12px 10px', width: '130px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItemCodes.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}>No Item Codes registered</div>
                    <div style={{ fontSize: '12px' }}>Use the form above to generate your first item code!</div>
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
                  Brand: {selectedLedgerItem.brand || 'General'} | Category: {selectedLedgerItem.category} | Style: {selectedLedgerItem.style || 'N/A'}
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
    </div>
  );
}
