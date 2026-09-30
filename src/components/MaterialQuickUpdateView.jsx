import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getBackendUrl } from '../utils/api';
import { getCleanImageUrl } from '../utils/designHelpers';
import {
  Search,
  Package,
  Layers,
  MapPin,
  FileText,
  Receipt,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Hash,
  Tag,
  Boxes,
  Clock,
  Sparkles,
  Barcode,
  Check,
  X,
  ChevronDown,
  Printer,
  ShieldCheck,
  History,
  Download,
  Filter
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MaterialQuickUpdateView({
  materials = [],
  racks = [],
  onUpdateMaterial,
  currentUser,
  currencySymbol = '₹'
}) {
  const [activeSubView, setActiveSubView] = useState('update'); // 'update' or 'history'
  const [searchIdInput, setSearchIdInput] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState(null);

  // Form Fields to Update
  const [poNumber, setPoNumber] = useState('');
  const [billNo, setBillNo] = useState('');
  const [rackLocation, setRackLocation] = useState('');
  const [inwardPacketsInput, setInwardPacketsInput] = useState('');
  const [isRackDropdownOpen, setIsRackDropdownOpen] = useState(false);

  // Quantity updates
  const [quantityMode, setQuantityMode] = useState('add'); // 'add' or 'set'
  const [addQtyInput, setAddQtyInput] = useState('');
  const [exactQtyInput, setExactQtyInput] = useState('');

  const [colorInput, setColorInput] = useState('');
  const [remarks, setRemarks] = useState('');

  // Confirmation Modal & Last Updated Record
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [lastUpdatedRecord, setLastUpdatedRecord] = useState(null);

  // Autocomplete state
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownOpen, setDropdownOpen] = useState(true);

  // History search filter
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Persisted Update History in localStorage
  const [updateHistory, setUpdateHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('mh_material_update_history');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const [recentSearchHistory, setRecentSearchHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('mh_material_recent_search');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const searchInputRef = useRef(null);
  const rackInputRef = useRef(null);
  const rackDropdownRef = useRef(null);
  const historySectionRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mh_material_update_history', JSON.stringify(updateHistory.slice(0, 200)));
    } catch (_) {}
  }, [updateHistory]);

  // Save recent search history
  useEffect(() => {
    try {
      localStorage.setItem('mh_material_recent_search', JSON.stringify(recentSearchHistory.slice(0, 10)));
    } catch (_) {}
  }, [recentSearchHistory]);

  // Extract all unique warehouse rack locations
  const availableWarehouseRacks = useMemo(() => {
    const set = new Set();
    // From props racks
    (racks || []).forEach(r => {
      if (typeof r === 'string' && r.trim()) set.add(r.trim());
      else if (r && r.name && typeof r.name === 'string') set.add(r.name.trim());
    });
    // From materials table locations
    (materials || []).forEach(m => {
      if (m.location && typeof m.location === 'string' && m.location.trim() && m.location !== 'N/A') {
        set.add(m.location.trim());
      }
    });
    // Defaults if empty
    if (set.size === 0) {
      ['Main Store - Rack 1', 'Main Store - Rack 2', 'Main Store - Rack 3', 'Hall 1 - Rack A', 'Hall 1 - Rack B'].forEach(r => set.add(r));
    }
    return Array.from(set).sort();
  }, [racks, materials]);

  // Matching warehouse racks when typing in Rack Location
  const matchingRacks = useMemo(() => {
    const filter = (rackLocation || '').trim().toLowerCase();
    if (!filter) return availableWarehouseRacks.slice(0, 10);
    return availableWarehouseRacks.filter(r => r.toLowerCase().includes(filter)).slice(0, 10);
  }, [availableWarehouseRacks, rackLocation]);

  // Close rack dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (rackDropdownRef.current && !rackDropdownRef.current.contains(e.target)) {
        setIsRackDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Populate form fields when a material is selected
  const populateMaterialData = (mat) => {
    if (!mat) return;
    setSelectedMaterial(mat);
    setSearchIdInput(mat.id);
    setDropdownOpen(false);
    setHighlightedIndex(-1);
    setPoNumber(mat.poNumber && mat.poNumber !== 'N/A' ? mat.poNumber : '');
    setBillNo(mat.invoiceNo && mat.invoiceNo !== 'N/A' ? mat.invoiceNo : '');
    setRackLocation(mat.location || 'Main Store');
    setInwardPacketsInput('');
    setColorInput(mat.color || '');
    setExactQtyInput(String(mat.stock || 0));
    setAddQtyInput('');
    setRemarks('');
    setSearchError('');
    setLastUpdatedRecord(null);

    // Add to recent search
    setRecentSearchHistory(prev => {
      const updated = [mat.id, ...prev.filter(id => id !== mat.id)];
      return updated.slice(0, 8);
    });
  };

  // Autocomplete suggestions as user types
  const matchingSuggestions = searchIdInput.trim().length >= 1 && dropdownOpen
    ? materials.filter(m =>
        String(m.id || '').toLowerCase().includes(searchIdInput.toLowerCase()) ||
        String(m.name || '').toLowerCase().includes(searchIdInput.toLowerCase())
      ).slice(0, 8)
    : [];

  // Fetch material details by ID (from local props + live backend)
  const handleFetchMaterial = async (idToSearch = null) => {
    const rawId = (idToSearch || searchIdInput || '').trim();
    if (!rawId) {
      setSearchError('Please enter a Material ID to fetch details.');
      return;
    }

    setLoadingFetch(true);
    setSearchError('');

    try {
      // 1. Check in loaded materials array first (exact match)
      const foundExact = materials.find(m =>
        String(m.id || '').toLowerCase() === rawId.toLowerCase()
      );

      if (foundExact) {
        populateMaterialData(foundExact);
        setLoadingFetch(false);
        showToast(`Material "${foundExact.name || foundExact.id}" loaded.`);
        return;
      }

      // 2. Check in loaded materials array for partial / prefix match or suggestion
      if (matchingSuggestions.length > 0) {
        const bestMatch = (highlightedIndex >= 0 && matchingSuggestions[highlightedIndex])
          ? matchingSuggestions[highlightedIndex]
          : matchingSuggestions[0];
        populateMaterialData(bestMatch);
        setLoadingFetch(false);
        showToast(`Material "${bestMatch.name || bestMatch.id}" loaded.`);
        return;
      }

      const foundPartial = materials.find(m =>
        String(m.id || '').toLowerCase().includes(rawId.toLowerCase()) ||
        String(m.name || '').toLowerCase().includes(rawId.toLowerCase())
      );

      if (foundPartial) {
        populateMaterialData(foundPartial);
        setLoadingFetch(false);
        showToast(`Material "${foundPartial.name || foundPartial.id}" loaded.`);
        return;
      }

      // 3. Fetch directly from backend API
      const cleanId = encodeURIComponent(rawId);
      const res = await fetch(`${getBackendUrl()}/api/materials/${cleanId}`);

      if (!res.ok) {
        throw new Error(`Material with ID "${rawId}" not found.`);
      }

      const matData = await res.json();
      populateMaterialData(matData);
      showToast(`Material "${matData.name || matData.id}" loaded.`);
    } catch (err) {
      console.warn('Material fetch warning:', err);
      setSearchError(err.message || 'Material ID not found. Please verify the code.');
      setSelectedMaterial(null);
    } finally {
      setLoadingFetch(false);
    }
  };

  // Calculate new total stock
  const currentStock = Number(selectedMaterial?.stock || 0);
  const inwardQtyNumber = parseFloat(addQtyInput) || 0;
  const calculatedStock = quantityMode === 'add'
    ? currentStock + inwardQtyNumber
    : (parseFloat(exactQtyInput) >= 0 ? parseFloat(exactQtyInput) : currentStock);

  // Calculate new total packets (INCREASES existing packets count)
  const currentPackets = parseInt(selectedMaterial?.packets, 10) || 1;
  const inwardPacketsNumber = parseInt(inwardPacketsInput, 10) || 0;
  const calculatedPackets = currentPackets + inwardPacketsNumber;

  // Trigger Confirmation Modal on Save Click
  const handleOpenConfirmation = (e) => {
    e?.preventDefault();

    if (!selectedMaterial) {
      showToast('Please fetch and select a material first.', 'error');
      return;
    }

    if (quantityMode === 'add' && inwardQtyNumber <= 0) {
      showToast('Please enter an incoming quantity to add (e.g. +50 Pcs).', 'error');
      return;
    }

    setShowConfirmModal(true);
  };

  // Execute Final Material Update
  const handleConfirmAndSaveUpdate = async () => {
    if (!selectedMaterial) return;

    setUpdating(true);

    const updatedPayload = {
      ...selectedMaterial,
      id: selectedMaterial.id,
      poNumber: poNumber.trim() || 'N/A',
      invoiceNo: billNo.trim() || 'N/A',
      location: rackLocation.trim() || 'Main Store',
      stock: calculatedStock,
      cost: selectedMaterial.cost || 0,
      color: colorInput.trim() || selectedMaterial.color || '',
      packets: calculatedPackets
    };

    try {
      // 1. Call parent update handler if provided
      if (typeof onUpdateMaterial === 'function') {
        await onUpdateMaterial(updatedPayload);
      } else {
        // Direct backend PUT request
        const res = await fetch(`${getBackendUrl()}/api/materials/${encodeURIComponent(selectedMaterial.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedPayload)
        });

        if (!res.ok) {
          throw new Error('Failed to update material on server.');
        }
      }

      // Record in local session update history
      const now = new Date();
      const historyItem = {
        id: selectedMaterial.id,
        name: selectedMaterial.name,
        category: selectedMaterial.category,
        oldStock: currentStock,
        newStock: calculatedStock,
        addedQty: quantityMode === 'add' ? inwardQtyNumber : (calculatedStock - currentStock),
        oldPackets: currentPackets,
        newPackets: calculatedPackets,
        addedPackets: inwardPacketsNumber,
        poNumber: updatedPayload.poNumber,
        invoiceNo: updatedPayload.invoiceNo,
        location: updatedPayload.location,
        unit: selectedMaterial.unit || 'Pcs',
        updatedBy: currentUser?.name || 'Store User',
        timestamp: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: now.toLocaleDateString('en-GB')
      };

      setUpdateHistory(prev => [historyItem, ...prev]);
      setLastUpdatedRecord(historyItem);
      setShowConfirmModal(false);

      showToast(`Material ${selectedMaterial.id} updated! +${quantityMode === 'add' ? inwardQtyNumber : calculatedStock} ${selectedMaterial.unit || 'Pcs'} added.`);

      // Update selected material state with new stock & packets
      setSelectedMaterial(updatedPayload);
      setAddQtyInput('');
      setExactQtyInput(String(calculatedStock));
      setInwardPacketsInput('');

      // Automatically switch to Update History view right after update
      setActiveSubView('history');

      setTimeout(() => {
        if (historySectionRef.current) {
          historySectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      console.error('Material update error:', err);
      showToast(err.message || 'Error updating material.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Export update history to CSV
  const handleExportCsv = () => {
    if (updateHistory.length === 0) return;
    const headers = ['Time', 'Date', 'Material ID', 'Material Name', 'Category', 'Inward Pieces', 'Total Stock', 'Unit', 'Inward Packets', 'Total Packets', 'Rack Location', 'PO Number', 'Bill Number', 'Updated By'];
    const rows = updateHistory.map(h => [
      `"${h.timestamp || ''}"`,
      `"${h.date || ''}"`,
      `"${h.id || ''}"`,
      `"${(h.name || '').replace(/"/g, '""')}"`,
      `"${(h.category || '').replace(/"/g, '""')}"`,
      h.addedQty !== null ? h.addedQty : 0,
      h.newStock,
      `"${h.unit || 'Pcs'}"`,
      h.addedPackets || 0,
      h.newPackets || 0,
      `"${(h.location || '').replace(/"/g, '""')}"`,
      `"${(h.poNumber || '').replace(/"/g, '""')}"`,
      `"${(h.invoiceNo || '').replace(/"/g, '""')}"`,
      `"${(h.updatedBy || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `material_update_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Normal Clean Black & White HTML Print Page Window
  const handleOpenPrintPage = (singleItem = null) => {
    const recordsToPrint = singleItem ? [singleItem] : (filteredHistory.length > 0 ? filteredHistory : updateHistory);
    if (recordsToPrint.length === 0) {
      showToast('No history records to print.', 'error');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1150,height=800');
    if (!printWindow) {
      showToast('Pop-up blocked. Please allow pop-ups for printing.', 'error');
      return;
    }

    let totalPieces = 0;
    let totalPkts = 0;
    recordsToPrint.forEach(r => {
      totalPieces += Number(r.addedQty) || 0;
      totalPkts += Number(r.addedPackets) || 0;
    });

    const rowsHtml = recordsToPrint.map((r, i) => `
      <tr>
        <td style="text-align: center; font-weight: bold;">${i + 1}</td>
        <td>
          <div style="font-weight: 600;">${r.timestamp || ''}</div>
          <div style="font-size: 10px; color: #444;">${r.date || ''}</div>
        </td>
        <td style="font-weight: bold; font-family: monospace; font-size: 12px;">${r.id || '-'}</td>
        <td style="font-weight: 600;">${r.name || '-'}</td>
        <td style="text-align: right; font-weight: bold;">${r.addedQty !== null ? `+${r.addedQty} ${r.unit || 'Pcs'}` : 'Override'}</td>
        <td style="text-align: right; font-weight: bold;">${r.newStock} ${r.unit || 'Pcs'}</td>
        <td style="text-align: right; font-weight: bold;">${r.addedPackets > 0 ? `+${r.addedPackets} pkts` : '0'}</td>
        <td style="text-align: right;">${r.newPackets} pkts</td>
        <td>${r.location || 'Main Store'}</td>
        <td>${r.poNumber || 'N/A'}</td>
        <td>${r.invoiceNo || 'N/A'}</td>
        <td>${r.updatedBy || 'Store'}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${singleItem ? `Inward Slip - ${singleItem.id}` : 'Material Inward & Update History'}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm 10mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 16px;
            font-size: 11px;
            line-height: 1.35;
          }
          .no-print-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f1f5f9;
            border: 1.5px solid #0f172a;
            padding: 10px 18px;
            border-radius: 8px;
            margin-bottom: 16px;
          }
          .btn-print {
            background: #000000;
            color: #ffffff;
            border: none;
            padding: 8px 20px;
            font-weight: 800;
            font-size: 13px;
            border-radius: 6px;
            cursor: pointer;
          }
          .btn-close {
            background: #ffffff;
            color: #000000;
            border: 1.5px solid #000000;
            padding: 8px 16px;
            font-weight: 800;
            font-size: 13px;
            border-radius: 6px;
            cursor: pointer;
            margin-left: 8px;
          }
          @media print {
            .no-print-bar {
              display: none !important;
            }
            body {
              padding: 0;
            }
          }
          .print-frame {
            border: 2px solid #000000;
            padding: 14px 16px;
            border-radius: 4px;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000000;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .doc-title {
            font-size: 17px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 3px 0;
          }
          .doc-sub {
            font-size: 11px;
            color: #222;
            font-weight: 500;
          }
          .meta-info {
            text-align: right;
            font-size: 10.5px;
          }
          .summary-box {
            display: flex;
            gap: 22px;
            background: #f4f4f4;
            border: 1px solid #000000;
            padding: 6px 12px;
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 12px;
          }
          table.data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
          }
          table.data-table th {
            background: #e8e8e8;
            color: #000000;
            border: 1px solid #000000;
            padding: 6px 7px;
            text-align: left;
            font-weight: bold;
            font-size: 10.5px;
          }
          table.data-table td {
            border: 1px solid #888888;
            padding: 5px 7px;
            vertical-align: middle;
          }
          table.data-table tr:nth-child(even) td {
            background: #fafafa;
          }
          .footer-sigs {
            margin-top: 32px;
            padding-top: 10px;
            display: flex;
            justify-content: space-between;
          }
          .sig-item {
            width: 28%;
            text-align: center;
          }
          .sig-line {
            border-top: 1.5px solid #000000;
            margin-bottom: 5px;
          }
          .sig-label {
            font-size: 10.5px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div>
            <strong>Print Preview:</strong> ${singleItem ? `Inward Slip - ${singleItem.id}` : `Material Update History (${recordsToPrint.length} records)`}
          </div>
          <div>
            <button class="btn-print" onclick="window.print()">🖨️ Print Document</button>
            <button class="btn-close" onclick="window.close()">✖ Close Window</button>
          </div>
        </div>

        <div class="print-frame">
          <div class="header-row">
            <div>
              <h1 class="doc-title">${singleItem ? 'MATERIAL INWARD & UPDATE SLIP' : 'MATERIAL INWARD & UPDATE AUDIT REPORT'}</h1>
              <div class="doc-sub">Official Store Inventory & Rack Location Audit Record (Black & White Format)</div>
            </div>
            <div class="meta-info">
              <div><strong>Date & Time:</strong> ${new Date().toLocaleString('en-IN')}</div>
              <div><strong>Generated By:</strong> ${currentUser?.name || 'Store In-Charge'}</div>
            </div>
          </div>

          <div class="summary-box">
            <div>Total Records: <strong>${recordsToPrint.length}</strong></div>
            <div>Total Inward Pieces: <strong>+${totalPieces}</strong></div>
            <div>Total Inward Packets: <strong>+${totalPkts} pkts</strong></div>
            ${historySearchQuery.trim() && !singleItem ? `<div>Filter Applied: <em>"${historySearchQuery.trim()}"</em></div>` : ''}
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">#</th>
                <th style="width: 85px;">Time / Date</th>
                <th style="width: 75px;">Material ID</th>
                <th>Material Name</th>
                <th style="width: 80px; text-align: right;">Inward Qty</th>
                <th style="width: 80px; text-align: right;">Total Stock</th>
                <th style="width: 75px; text-align: right;">Inward Pkts</th>
                <th style="width: 75px; text-align: right;">Total Pkts</th>
                <th style="width: 110px;">Warehouse Rack</th>
                <th style="width: 85px;">PO Number</th>
                <th style="width: 85px;">Bill No</th>
                <th style="width: 75px;">Updated By</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer-sigs">
            <div class="sig-item">
              <div class="sig-line"></div>
              <div class="sig-label">Store In-Charge Signature & Date</div>
            </div>
            <div class="sig-item">
              <div class="sig-line"></div>
              <div class="sig-label">Audited / Verified By</div>
            </div>
            <div class="sig-item">
              <div class="sig-line"></div>
              <div class="sig-label">Authorized Signatory</div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Print / Generate Professional Black & White PDF Report for Update History
  const handlePrintPdf = (singleItem = null) => {
    try {
      const recordsToPrint = singleItem ? [singleItem] : (filteredHistory.length > 0 ? filteredHistory : updateHistory);
      if (recordsToPrint.length === 0) {
        showToast('No history records to print.', 'error');
        return;
      }

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Outer solid black border frame (Printer standard)
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1.2);
      doc.rect(20, 20, pageWidth - 40, pageHeight - 40);

      // Top Header Title (Crisp Black & White)
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(singleItem ? 'MATERIAL INWARD / UPDATE SLIP' : 'MATERIAL INWARD & UPDATE AUDIT REPORT', 32, 40);

      // Right-aligned Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`Official B&W Record • Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 32, 38, { align: 'right' });
      doc.text(`User: ${currentUser?.name || 'Store In-Charge'}`, pageWidth - 32, 49, { align: 'right' });

      // Solid dividing line below header
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1.5);
      doc.line(20, 56, pageWidth - 20, 56);

      // Summary Bar below Header (Clean Black & White box)
      let totalPiecesAdded = 0;
      let totalPacketsAdded = 0;
      recordsToPrint.forEach(r => {
        totalPiecesAdded += Number(r.addedQty) || 0;
        totalPacketsAdded += Number(r.addedPackets) || 0;
      });

      doc.setFillColor(245, 245, 245);
      doc.rect(20, 56, pageWidth - 40, 20, 'F');
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.8);
      doc.line(20, 76, pageWidth - 20, 76);

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`Total Records: ${recordsToPrint.length}`, 32, 70);
      doc.text(`Total Inward Pieces Added: +${totalPiecesAdded}`, 160, 70);
      doc.text(`Total Inward Packets Added: +${totalPacketsAdded} pkts`, 380, 70);
      if (historySearchQuery.trim() && !singleItem) {
        doc.setFont('helvetica', 'italic');
        doc.text(`Filter Applied: "${historySearchQuery.trim()}"`, 570, 70);
      }

      // Prepare Table Data
      const tableHead = [[
        '#',
        'Time / Date',
        'Material ID',
        'Material Name',
        'Inward Pieces',
        'Total Stock',
        'Inward Pkts',
        'Total Pkts',
        'Warehouse Rack',
        'PO Number',
        'Bill No',
        'Updated By'
      ]];

      const tableBody = recordsToPrint.map((r, i) => [
        i + 1,
        `${r.timestamp || ''}\n${r.date || ''}`,
        r.id || '-',
        r.name || '-',
        r.addedQty !== null ? `+${r.addedQty} ${r.unit || 'Pcs'}` : 'Override',
        `${r.newStock} ${r.unit || 'Pcs'}`,
        r.addedPackets > 0 ? `+${r.addedPackets} pkts` : '0',
        `${r.newPackets} pkts`,
        r.location || 'Main Store',
        r.poNumber || 'N/A',
        r.invoiceNo || 'N/A',
        r.updatedBy || 'Store'
      ]);

      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: 84,
        margin: { left: 26, right: 26, bottom: 65 },
        styles: {
          fontSize: 8,
          cellPadding: 4.5,
          textColor: [0, 0, 0],
          lineColor: [180, 180, 180],
          lineWidth: 0.5,
          fillColor: [255, 255, 255]
        },
        headStyles: {
          fillColor: [230, 230, 230],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'left',
          lineWidth: 1,
          lineColor: [0, 0, 0]
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250]
        },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },
          1: { cellWidth: 64, fontSize: 7 },
          2: { cellWidth: 65, fontStyle: 'bold' },
          3: { cellWidth: 140 },
          4: { cellWidth: 70, fontStyle: 'bold', halign: 'right' },
          5: { cellWidth: 65, fontStyle: 'bold', halign: 'right' },
          6: { cellWidth: 54, halign: 'right', fontStyle: 'bold' },
          7: { cellWidth: 54, halign: 'right' },
          8: { cellWidth: 85 },
          9: { cellWidth: 66 },
          10: { cellWidth: 66 },
          11: { cellWidth: 55 }
        },
        didDrawPage: () => {
          // Footer
          const pageStr = `Page ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(7.5);
          doc.setTextColor(60, 60, 60);
          doc.text(pageStr, pageWidth - 60, pageHeight - 24);
          doc.text('CONFIDENTIAL • Store Inventory & Material Management System • Black & White Audit Record', 32, pageHeight - 24);

          // Solid Black Signatures block on bottom
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(1);
          const sigY = pageHeight - 44;
          doc.line(32, sigY, 160, sigY);
          doc.line(250, sigY, 380, sigY);
          doc.line(470, sigY, 600, sigY);

          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text('Store In-Charge (Sign & Date)', 36, sigY + 11);
          doc.text('Audited / Verified By', 260, sigY + 11);
          doc.text('Authorized Signatory', 485, sigY + 11);
        }
      });

      // Save PDF and open preview/print
      const fileName = singleItem
        ? `Inward_Slip_${singleItem.id}_${new Date().toISOString().slice(0, 10)}.pdf`
        : `Material_Update_History_${new Date().toISOString().slice(0, 10)}.pdf`;

      doc.save(fileName);

      // Open in new window for instant browser print
      const blobPdf = doc.output('bloburl');
      if (blobPdf) {
        window.open(blobPdf, '_blank');
      }

      showToast(`B&W PDF Generated: ${fileName}`);
    } catch (err) {
      console.error('PDF print generation error:', err);
      showToast('Error generating PDF: ' + err.message, 'error');
    }
  };

  // Reset form to scan next material
  const handleResetForNext = () => {
    setSelectedMaterial(null);
    setSearchIdInput('');
    setDropdownOpen(true);
    setHighlightedIndex(-1);
    setPoNumber('');
    setBillNo('');
    setRackLocation('');
    setAddQtyInput('');
    setExactQtyInput('');
    setInwardPacketsInput('');
    setColorInput('');
    setRemarks('');
    setSearchError('');
    setLastUpdatedRecord(null);
    setActiveSubView('update');
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);
  };

  // Filtered history
  const filteredHistory = useMemo(() => {
    if (!historySearchQuery.trim()) return updateHistory;
    const q = historySearchQuery.toLowerCase();
    return updateHistory.filter(h =>
      String(h.id || '').toLowerCase().includes(q) ||
      String(h.name || '').toLowerCase().includes(q) ||
      String(h.poNumber || '').toLowerCase().includes(q) ||
      String(h.invoiceNo || '').toLowerCase().includes(q) ||
      String(h.location || '').toLowerCase().includes(q) ||
      String(h.updatedBy || '').toLowerCase().includes(q)
    );
  }, [updateHistory, historySearchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: '1200px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 99999,
          padding: '12px 20px',
          borderRadius: '10px',
          background: toast.type === 'error' ? '#ef4444' : '#059669',
          color: '#ffffff',
          fontWeight: '700',
          fontSize: '13.5px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* HEADER CARD WITH VIEW TOGGLE */}
      <div className="panel" style={{
        padding: '20px 24px',
        borderRadius: '14px 14px 0 0',
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #cbd5e1)',
        borderBottom: 'none',
        boxShadow: 'none'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', boxShadow: '0 4px 10px rgba(5, 150, 105, 0.3)'
              }}>
                <Boxes size={22} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                  Quick Material Inward & Details Update
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                  Enter or scan Material ID &bull; Update PO No, Bill No, Warehouse Rack & Inward Quantity
                </span>
              </div>
            </div>
          </div>

          {/* VIEW SWITCH & RESET BUTTONS */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <button
                type="button"
                onClick={() => setActiveSubView('update')}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: 'none',
                  background: activeSubView === 'update' ? '#059669' : 'transparent',
                  color: activeSubView === 'update' ? '#ffffff' : '#475569',
                  fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Plus size={14} />
                <span>Inward Entry</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubView('history')}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: 'none',
                  background: activeSubView === 'history' ? '#0f172a' : 'transparent',
                  color: activeSubView === 'history' ? '#ffffff' : '#475569',
                  fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <History size={14} />
                <span>Update History ({updateHistory.length})</span>
              </button>
            </div>

            {selectedMaterial && activeSubView === 'update' && (
              <button
                type="button"
                onClick={handleResetForNext}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={14} />
                <span>Next Item</span>
              </button>
            )}
          </div>
        </div>

        {/* SEARCH BAR & SCANNER INPUT (VISIBLE ON UPDATE VIEW) */}
        {activeSubView === 'update' && (
          <div style={{ marginTop: '20px', position: 'relative' }}>
            <label style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Barcode size={16} color="#059669" />
              <span>Enter Material ID or Barcode:</span>
            </label>

            <div style={{ display: 'flex', gap: '10px', maxWidth: '720px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchIdInput}
                  onChange={(e) => {
                    setSearchIdInput(e.target.value);
                    setDropdownOpen(true);
                    setHighlightedIndex(-1);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (matchingSuggestions.length > 0) {
                        setHighlightedIndex(prev => (prev + 1) % matchingSuggestions.length);
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      if (matchingSuggestions.length > 0) {
                        setHighlightedIndex(prev => (prev - 1 + matchingSuggestions.length) % matchingSuggestions.length);
                      }
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (highlightedIndex >= 0 && matchingSuggestions[highlightedIndex]) {
                        populateMaterialData(matchingSuggestions[highlightedIndex]);
                      } else {
                        handleFetchMaterial();
                      }
                    } else if (e.key === 'Escape') {
                      setDropdownOpen(false);
                    }
                  }}
                  placeholder="e.g. MT1000, Zip, BTN-001, or scan barcode..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border-color, #cbd5e1)',
                    background: 'var(--bg-input, #f8fafc)',
                    fontSize: '15px',
                    fontWeight: '700',
                    color: 'var(--text-main, #0f172a)',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
                <Search size={19} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />

                {/* Autocomplete Dropdown */}
                {matchingSuggestions.length > 0 && !selectedMaterial && dropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1.5px solid #059669',
                    boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    maxHeight: '340px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Select a Material ({matchingSuggestions.length} matches):
                    </div>
                    {matchingSuggestions.map((m, idx) => (
                      <div
                        key={m.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          populateMaterialData(m);
                        }}
                        onClick={() => populateMaterialData(m)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        style={{
                          padding: '11px 14px',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: highlightedIndex === idx ? '#ecfdf5' : '#ffffff',
                          borderLeft: highlightedIndex === idx ? '4px solid #059669' : '4px solid transparent',
                          transition: 'all 0.1s'
                        }}
                      >
                        <div>
                          <strong style={{ color: '#059669', fontSize: '14px', marginRight: '8px' }}>{m.id}</strong>
                          <span style={{ color: '#0f172a', fontWeight: '700', fontSize: '13px' }}>{m.name}</span>
                          <span style={{ color: '#64748b', fontSize: '11.5px', marginLeft: '8px' }}>({m.category || 'General'})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{m.location || 'Main Store'}</span>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', background: '#dcfce7', padding: '3px 8px', borderRadius: '4px' }}>
                            Stock: {m.stock || 0} {m.unit || 'Pcs'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleFetchMaterial()}
                disabled={loadingFetch}
                style={{
                  padding: '0 26px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: loadingFetch ? 'wait' : 'pointer',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {loadingFetch ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                <span>{loadingFetch ? 'Fetching...' : 'Fetch Details'}</span>
              </button>
            </div>

            {/* Recent Searches */}
            {recentSearchHistory.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>Recent IDs:</span>
                {recentSearchHistory.map(id => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setSearchIdInput(id); handleFetchMaterial(id); }}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f1f5f9',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    {id}
                  </button>
                ))}
              </div>
            )}

            {searchError && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={16} />
                <span>{searchError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* POST-UPDATE CONFIRMATION RECEIPT CARD */}
      {lastUpdatedRecord && (
        <div style={{
          padding: '18px 24px',
          borderRadius: 0,
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          borderLeft: '1px solid var(--border-color, #cbd5e1)',
          borderRight: '1px solid var(--border-color, #cbd5e1)',
          borderTop: '1px solid #86efac',
          borderBottom: '1px solid #86efac',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: '#22c55e', color: '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(34, 197, 94, 0.3)'
              }}>
                <CheckCircle2 size={26} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#15803d' }}>
                  Material Stock & Location Updated Successfully!
                </h3>
                <div style={{ fontSize: '13px', color: '#166534', marginTop: '3px' }}>
                  Added <strong>+{lastUpdatedRecord.addedQty} {lastUpdatedRecord.unit}</strong> {lastUpdatedRecord.addedPackets > 0 ? `(+${lastUpdatedRecord.addedPackets} packets)` : ''} to <strong>{lastUpdatedRecord.id} • {lastUpdatedRecord.name}</strong>.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleOpenPrintPage(lastUpdatedRecord)}
                style={{
                  padding: '9px 16px', borderRadius: '8px',
                  border: '1.5px solid #15803d', background: '#ffffff',
                  color: '#15803d', fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 2px 6px rgba(21, 128, 61, 0.15)'
                }}
                title="Print Inward Slip for this material"
              >
                <Printer size={15} />
                <span>Print Slip</span>
              </button>

              <button
                type="button"
                onClick={handleResetForNext}
                style={{
                  padding: '9px 18px', borderRadius: '8px',
                  border: 'none', background: '#15803d', color: '#ffffff',
                  fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 2px 8px rgba(21, 128, 61, 0.3)'
                }}
              >
                <Plus size={15} />
                <span>Update Next Material</span>
              </button>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px dashed #86efac',
            fontSize: '12.5px'
          }}>
            <div><span style={{ color: '#166534' }}>New Total Stock:</span> <strong style={{ color: '#15803d', fontSize: '15px' }}>{lastUpdatedRecord.newStock} {lastUpdatedRecord.unit}</strong></div>
            <div><span style={{ color: '#166534' }}>Total Packets:</span> <strong>{lastUpdatedRecord.newPackets} Packets {lastUpdatedRecord.addedPackets > 0 ? `(+${lastUpdatedRecord.addedPackets} inward)` : ''}</strong></div>
            <div><span style={{ color: '#166534' }}>Warehouse Rack:</span> <strong>{lastUpdatedRecord.location}</strong></div>
            <div><span style={{ color: '#166534' }}>PO Number:</span> <strong>{lastUpdatedRecord.poNumber}</strong></div>
            <div><span style={{ color: '#166534' }}>Invoice / Bill:</span> <strong>{lastUpdatedRecord.invoiceNo}</strong></div>
          </div>
        </div>
      )}

      {/* SUBVIEW 1: INWARD ENTRY UPDATE FORM */}
      {activeSubView === 'update' && (
        <>
          {selectedMaterial ? (
            <form onSubmit={handleOpenConfirmation} className="panel" style={{
              padding: '24px 28px',
              borderRadius: '0 0 14px 14px',
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #cbd5e1)',
              borderTop: '1px solid #e2e8f0',
              boxShadow: 'none'
            }}>
              {/* SECTION 1: FETCHED MATERIAL IDENTITY CARD */}
              <div style={{
                padding: '16px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1.5px solid #86efac',
                marginBottom: '22px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '6px',
                      background: '#059669', color: '#ffffff',
                      fontSize: '13px', fontWeight: '900', letterSpacing: '0.5px'
                    }}>
                      ID: {selectedMaterial.id}
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#047857' }}>
                      {selectedMaterial.name}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      &bull; {selectedMaterial.category || 'General Material'}
                    </span>
                  </div>

                  {/* CURRENT STOCK & PACKETS BADGE */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: '#ffffff',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #059669',
                      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.15)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Current Stock:</span>
                      <span style={{ fontSize: '16px', fontWeight: '900', color: '#059669' }}>
                        {selectedMaterial.stock || 0} {selectedMaterial.unit || 'Pcs'}
                      </span>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#ffffff',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Current Packets:</span>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                        {selectedMaterial.packets || 1} pkts
                      </span>
                    </div>
                  </div>
                </div>

                {/* QUICK META DETAILS GRID */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  fontSize: '12px',
                  borderTop: '1px dashed #86efac',
                  paddingTop: '10px'
                }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px', fontWeight: '700' }}>CURRENT RACK / LOCATION</span>
                    <strong style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} color="#059669" />
                      {selectedMaterial.location || 'Main Store'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px', fontWeight: '700' }}>CURRENT PO NUMBER</span>
                    <strong style={{ color: '#0f172a' }}>{selectedMaterial.poNumber || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px', fontWeight: '700' }}>CURRENT BILL / INVOICE NO</span>
                    <strong style={{ color: '#0f172a' }}>{selectedMaterial.invoiceNo || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px', fontWeight: '700' }}>COLOR / VARIANT</span>
                    <strong style={{ color: '#0f172a' }}>{selectedMaterial.color || 'Standard'}</strong>
                  </div>
                </div>
              </div>

              {/* SECTION 2: UPDATE FORM FIELDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '22px' }}>
                
                {/* LEFT COLUMN: PO NO, BILL NO, RACK NO & INCOMING PACKETS */}
                <div style={{
                  padding: '18px 20px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} color="#059669" />
                    <span>Reference & Location Updates</span>
                  </h4>

                  {/* PO NUMBER */}
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <FileText size={14} color="#059669" />
                      <span>PO Number (Purchase Order):</span>
                    </label>
                    <input
                      type="text"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      placeholder="e.g. PO-2026-0881"
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        border: '1.5px solid #cbd5e1', background: '#ffffff',
                        fontSize: '13.5px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* BILL NO / INVOICE NO */}
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Receipt size={14} color="#059669" />
                      <span>Bill / Invoice Number:</span>
                    </label>
                    <input
                      type="text"
                      value={billNo}
                      onChange={(e) => setBillNo(e.target.value)}
                      placeholder="e.g. INV-9942, Bill-771"
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        border: '1.5px solid #cbd5e1', background: '#ffffff',
                        fontSize: '13.5px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* RACK NO / STORE LOCATION WITH LIVE WAREHOUSE RECOMMENDATIONS */}
                  <div ref={rackDropdownRef} style={{ position: 'relative' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <MapPin size={14} color="#059669" />
                      <span>Rack Number / Store Location:</span>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600', marginLeft: 'auto' }}>Warehouse Racks Available</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        ref={rackInputRef}
                        type="text"
                        value={rackLocation}
                        onChange={(e) => {
                          setRackLocation(e.target.value);
                          setIsRackDropdownOpen(true);
                        }}
                        onFocus={() => setIsRackDropdownOpen(true)}
                        placeholder="Type or select warehouse rack (e.g. Main Store - Rack 2)..."
                        style={{
                          width: '100%', padding: '10px 36px 10px 12px', borderRadius: '8px',
                          border: '1.5px solid #cbd5e1', background: '#ffffff',
                          fontSize: '13.5px', fontWeight: '700', color: '#0f172a', boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setIsRackDropdownOpen(prev => !prev)}
                        style={{
                          position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                          background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
                          padding: '4px'
                        }}
                        title="Toggle warehouse rack list"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>

                    {/* Warehouse Rack Recommendations Dropdown */}
                    {isRackDropdownOpen && matchingRacks.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: '#ffffff',
                        borderRadius: '10px',
                        border: '1.5px solid #059669',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        maxHeight: '220px',
                        overflowY: 'auto'
                      }}>
                        <div style={{ padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                          Warehouse Locations ({matchingRacks.length}):
                        </div>
                        {matchingRacks.map((rackName) => (
                          <div
                            key={rackName}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setRackLocation(rackName);
                              setIsRackDropdownOpen(false);
                            }}
                            onClick={() => {
                              setRackLocation(rackName);
                              setIsRackDropdownOpen(false);
                            }}
                            style={{
                              padding: '9px 12px',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '13px',
                              fontWeight: '600',
                              color: '#0f172a',
                              background: rackLocation === rackName ? '#ecfdf5' : '#ffffff',
                              transition: 'background 0.1s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdf4'}
                            onMouseLeave={(e) => e.currentTarget.style.background = rackLocation === rackName ? '#ecfdf5' : '#ffffff'}
                          >
                            <MapPin size={13} color="#059669" />
                            <span>{rackName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* INCOMING PACKETS TO ADD (INCREASES EXISTING PACKET COUNT) */}
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Boxes size={14} color="#059669" />
                      <span>Incoming / Inward Packets to Add:</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        min="0"
                        value={inwardPacketsInput}
                        onChange={(e) => setInwardPacketsInput(e.target.value)}
                        placeholder="e.g. 1, 2, 5... (adds to existing packets)"
                        style={{
                          flex: 1, padding: '10px 12px', borderRadius: '8px',
                          border: '1.5px solid #059669', background: '#f0fdf4',
                          fontSize: '14px', fontWeight: '800', color: '#047857', boxSizing: 'border-box'
                        }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b' }}>Packets</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#047857', fontWeight: '700', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Current: <strong>{currentPackets} pkts</strong></span>
                      <span>New Total: <strong>{calculatedPackets} Packets</strong></span>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: STOCK QUANTITY UPDATE & CALCULATION */}
                <div style={{
                  padding: '18px 20px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Package size={16} color="#059669" />
                      <span>Stock Quantity (Pieces) Update</span>
                    </h4>

                    {/* MODE TOGGLE */}
                    <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setQuantityMode('add')}
                        style={{
                          padding: '4px 10px', borderRadius: '6px', border: 'none',
                          background: quantityMode === 'add' ? '#059669' : 'transparent',
                          color: quantityMode === 'add' ? '#ffffff' : '#475569',
                          fontSize: '11.5px', fontWeight: '800', cursor: 'pointer'
                        }}
                      >
                        + Add Inward
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuantityMode('set')}
                        style={{
                          padding: '4px 10px', borderRadius: '6px', border: 'none',
                          background: quantityMode === 'set' ? '#0f172a' : 'transparent',
                          color: quantityMode === 'set' ? '#ffffff' : '#475569',
                          fontSize: '11.5px', fontWeight: '800', cursor: 'pointer'
                        }}
                      >
                        = Override Total
                      </button>
                    </div>
                  </div>

                  {/* QUANTITY INPUT ACCORDING TO MODE */}
                  {quantityMode === 'add' ? (
                    <div style={{
                      padding: '16px', borderRadius: '10px',
                      background: '#ffffff', border: '1.5px solid #86efac',
                      boxShadow: '0 2px 8px rgba(5, 150, 105, 0.08)'
                    }}>
                      <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <Plus size={15} />
                        <span>Incoming / Inward Quantity to Add ({selectedMaterial.unit || 'Pcs'}):</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={addQtyInput}
                          onChange={(e) => setAddQtyInput(e.target.value)}
                          placeholder="e.g. 50, 100, 500"
                          autoFocus
                          style={{
                            flex: 1, padding: '12px 14px', borderRadius: '8px',
                            border: '2px solid #059669', fontSize: '20px', fontWeight: '900',
                            color: '#047857', background: '#f0fdf4', outline: 'none'
                          }}
                        />
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#047857' }}>
                          {selectedMaterial.unit || 'Pcs'}
                        </span>
                      </div>

                      {/* QUICK QUANTITY BUTTONS */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                        {[10, 20, 50, 100, 200, 500, 1000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setAddQtyInput(String((parseFloat(addQtyInput) || 0) + amt))}
                            style={{
                              padding: '4px 9px', borderRadius: '6px',
                              border: '1px solid #86efac', background: '#f0fdf4',
                              color: '#047857', fontSize: '11px', fontWeight: '800', cursor: 'pointer'
                            }}
                          >
                            +{amt}
                          </button>
                        ))}
                        {addQtyInput && (
                          <button
                            type="button"
                            onClick={() => setAddQtyInput('')}
                            style={{
                              padding: '4px 9px', borderRadius: '6px',
                              border: '1px solid #cbd5e1', background: '#f1f5f9',
                              color: '#64748b', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '16px', borderRadius: '10px',
                      background: '#ffffff', border: '1.5px solid #cbd5e1'
                    }}>
                      <label style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                        Exact New Total Stock ({selectedMaterial.unit || 'Pcs'}):
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={exactQtyInput}
                        onChange={(e) => setExactQtyInput(e.target.value)}
                        style={{
                          width: '100%', padding: '12px 14px', borderRadius: '8px',
                          border: '2px solid #0f172a', fontSize: '20px', fontWeight: '900',
                          color: '#0f172a', background: '#ffffff', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  )}

                  {/* LIVE STOCK PREVIEW BANNER */}
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                    border: '1.5px solid #6ee7b7',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Projected Stock Calculation
                      </span>
                      <div style={{ fontSize: '13px', color: '#047857', fontWeight: '700', marginTop: '2px' }}>
                        {quantityMode === 'add' ? (
                          <>Current: <strong>{currentStock}</strong> + Inward: <strong>{inwardQtyNumber}</strong></>
                        ) : (
                          <>Direct Override from <strong>{currentStock}</strong></>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: '#065f46', fontWeight: '700' }}>NEW TOTAL STOCK:</span>
                      <div style={{ fontSize: '20px', fontWeight: '900', color: '#065f46' }}>
                        {calculatedStock} <span style={{ fontSize: '13px' }}>{selectedMaterial.unit || 'Pcs'}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* SUBMIT ACTION BAR */}
              <div style={{
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1.5px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  Updating material <strong>{selectedMaterial.id}</strong> &bull; Location: <strong>{rackLocation || 'Main Store'}</strong> &bull; Total Packets: <strong>{calculatedPackets}</strong>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleResetForNext}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={updating}
                    style={{
                      padding: '12px 28px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: '900',
                      cursor: updating ? 'wait' : 'pointer',
                      boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {updating ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    <span>Save & Update Material Stock</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* EMPTY STATE / SCAN INSTRUCTION CARD */
            <div className="panel" style={{
              padding: '44px 20px',
              textAlign: 'center',
              borderRadius: '0 0 14px 14px',
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #cbd5e1)',
              borderTop: '1px dashed #e2e8f0',
              boxShadow: 'none'
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px auto', color: '#059669'
              }}>
                <Search size={30} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                No Material Selected Yet
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted, #64748b)', maxWidth: '440px', marginInline: 'auto' }}>
                Type or scan any <strong>Material ID</strong> in the search bar above to fetch current details and quickly update PO No, Bill No, Warehouse Rack, Packets, and Inward Quantity.
              </p>
            </div>
          )}
        </>
      )}

      {/* CONFIRMATION MODAL POPUP BEFORE SAVING */}
      {showConfirmModal && selectedMaterial && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            border: '2px solid #059669',
            animation: 'scaleUp 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 22px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={22} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                  Confirm Material Inward & Updates
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px 24px' }}>
              <div style={{
                padding: '14px 16px',
                borderRadius: '10px',
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                marginBottom: '18px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>
                  Target Material
                </div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#047857', marginTop: '2px' }}>
                  {selectedMaterial.id} &bull; {selectedMaterial.name}
                </div>
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  Category: {selectedMaterial.category || 'Accessory'}
                </div>
              </div>

              {/* Breakdown Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '18px'
              }}>
                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block' }}>INWARD PIECES ADDED</span>
                  <strong style={{ fontSize: '16px', color: '#059669', display: 'block', marginTop: '2px' }}>
                    +{quantityMode === 'add' ? inwardQtyNumber : (calculatedStock - currentStock)} {selectedMaterial.unit || 'Pcs'}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    ({currentStock} ➔ {calculatedStock} {selectedMaterial.unit || 'Pcs'})
                  </span>
                </div>

                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block' }}>INWARD PACKETS ADDED</span>
                  <strong style={{ fontSize: '16px', color: '#059669', display: 'block', marginTop: '2px' }}>
                    +{inwardPacketsNumber} Packets
                  </strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    ({currentPackets} ➔ {calculatedPackets} pkts)
                  </span>
                </div>

                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block' }}>PO NUMBER</span>
                  <strong style={{ fontSize: '13.5px', color: '#0f172a', display: 'block', marginTop: '2px' }}>
                    {poNumber.trim() || 'N/A'}
                  </strong>
                </div>

                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', display: 'block' }}>BILL / INVOICE NO</span>
                  <strong style={{ fontSize: '13.5px', color: '#0f172a', display: 'block', marginTop: '2px' }}>
                    {billNo.trim() || 'N/A'}
                  </strong>
                </div>
              </div>

              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px'
              }}>
                <MapPin size={16} color="#059669" />
                <span>Warehouse Rack Location: <strong style={{ color: '#0f172a' }}>{rackLocation.trim() || 'Main Store'}</strong></span>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              padding: '16px 24px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Back & Modify
              </button>

              <button
                type="button"
                onClick={handleConfirmAndSaveUpdate}
                disabled={updating}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '900',
                  cursor: updating ? 'wait' : 'pointer',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {updating ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                <span>Confirm & Apply Update</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE HISTORY TABLE (PROMINENTLY DISPLAYED & PERSISTED) */}
      <div ref={historySectionRef} className="panel" style={{
        padding: '22px 26px',
        borderRadius: '0 0 14px 14px',
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #cbd5e1)',
        borderTop: '1px solid #e2e8f0',
        boxShadow: 'none'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: '#0f172a', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <History size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                Material Inward & Update History ({filteredHistory.length} records)
              </h3>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)' }}>
                Live audit trail of all quick inward additions, packets, and rack location changes
              </span>
            </div>
          </div>

          {/* Search filter in history */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '240px' }}>
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="Filter history by ID, PO, Rack..."
                style={{
                  width: '100%', padding: '8px 10px 8px 30px', borderRadius: '8px',
                  border: '1.5px solid #cbd5e1', fontSize: '12.5px', fontWeight: '600',
                  color: '#0f172a', boxSizing: 'border-box'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            </div>

            {updateHistory.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenPrintPage()}
                  style={{
                    padding: '7px 14px', borderRadius: '8px',
                    border: '1px solid #0f172a', background: '#0f172a',
                    color: '#ffffff', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.2)'
                  }}
                  title="Open Normal Print Page for Printing (Black & White)"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintPdf()}
                  style={{
                    padding: '7px 11px', borderRadius: '8px',
                    border: '1.5px solid #cbd5e1', background: '#ffffff',
                    color: '#334155', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px'
                  }}
                  title="Download Inward & Update History as PDF file"
                >
                  <FileText size={13} />
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  style={{
                    padding: '7px 12px', borderRadius: '8px',
                    border: '1px solid #059669', background: '#f0fdf4',
                    color: '#059669', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px'
                  }}
                  title="Download Inward & Update History as CSV"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Clear local session history list? (Database materials are unaffected)')) {
                      setUpdateHistory([]);
                      localStorage.removeItem('mh_material_update_history');
                    }
                  }}
                  style={{
                    padding: '7px 12px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#f8fafc',
                    color: '#64748b', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer'
                  }}
                  title="Clear local update history list"
                >
                  Clear Log
                </button>
              </>
            )}
          </div>
        </div>

        {filteredHistory.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary, #f8fafc)', borderBottom: '2px solid var(--border-color, #cbd5e1)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Time / Date</th>
                  <th style={{ padding: '10px 12px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Material ID</th>
                  <th style={{ padding: '10px 12px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Material Name</th>
                  <th style={{ padding: '10px 12px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Inward Pieces</th>
                  <th style={{ padding: '10px 12px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Total Stock</th>
                  <th style={{ padding: '10px 12px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Inward Packets</th>
                  <th style={{ padding: '10px 12px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Total Packets</th>
                  <th style={{ padding: '10px 12px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Rack Location</th>
                  <th style={{ padding: '10px 12px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>PO No</th>
                  <th style={{ padding: '10px 12px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>Bill No</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((row, idx) => {
                  const isJustUpdated = lastUpdatedRecord && lastUpdatedRecord.id === row.id && lastUpdatedRecord.timestamp === row.timestamp;
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--border-color, #f1f5f9)',
                        background: isJustUpdated ? '#ecfdf5' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                    >
                      <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        <div>{row.timestamp}</div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{row.date || 'Today'}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '800', color: '#059669' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{row.id}</span>
                          {isJustUpdated && (
                            <span style={{
                              fontSize: '9.5px', fontWeight: '900', padding: '1px 6px',
                              borderRadius: '4px', background: '#059669', color: '#ffffff'
                            }}>
                              NEW
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: 'var(--text-main, #0f172a)' }}>{row.name}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '800', color: '#059669' }}>
                        {row.addedQty !== null ? `+${row.addedQty} ${row.unit}` : 'Override'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '800', color: '#0f172a' }}>
                        {row.newStock} {row.unit}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '800', color: '#059669' }}>
                        +{row.addedPackets} pkts
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#334155' }}>
                        {row.newPackets} pkts
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#334155' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} color="#059669" />
                          {row.location}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{row.poNumber}</td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{row.invoiceNo}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{
            padding: '30px 20px',
            textAlign: 'center',
            color: 'var(--text-muted, #64748b)',
            fontSize: '13px'
          }}>
            No update records found yet. Updates performed will appear here automatically.
          </div>
        )}
      </div>
    </div>
  );
}
