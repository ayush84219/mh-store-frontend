import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Download, Search, FileText, Truck, Calendar, User,
  ChevronRight, RefreshCw, AlertCircle, Scissors, Layers, Tag
} from 'lucide-react';
import { generatePurchaseOrderPDF, downloadPdfBlob, toDataURL_QR, buildPoQrUrls } from './GeneratePOView';
import { generateRgpPDF, generateQRCode } from './rgp';
import { generateIssuePdf as generateZipIssuePdf } from './pogenerate';
import { generateIssuePdf as generateDoriIssuePdf } from './dooripogenerate';

const formatDateSafe = (dateVal) => {
  try {
    if (!dateVal) return new Date().toISOString().split('T')[0];
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    return d.toISOString().split('T')[0];
  } catch (_) {
    return new Date().toISOString().split('T')[0];
  }
};

export default function ReDownloadView({ currencySymbol = 'R', currentUser = null }) {
  const [activeSubTab, setActiveSubTab] = useState('po'); // 'po', 'zip', 'dori', 'rgp'
  const [poList, setPoList] = useState([]);
  const [zipPoList, setZipPoList] = useState([]);
  const [doriPoList, setDoriPoList] = useState([]);
  const [rgpList, setRgpList] = useState([]);
  const [zipQualityData, setZipQualityData] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Fetch zip quality helper database references on mount
  useEffect(() => {
    const loadZipData = async () => {
      try {
        const url = 'https://docs.google.com/spreadsheets/d/16mifNw0WMIlnZ1XRHsuH_8kVUm_6Y1O3uVsoM-Hjppo/export?format=csv';
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          const rows = text.split('\n').map(r => r.split(','));
          const parsed = [];
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (r.length >= 3) {
              const priceNum = parseFloat(String(r[2] || '').replace(/[₹,"]/g, '').trim()) || 0;
              parsed.push({
                type: (r[0] || '').replace(/"/g, '').trim(),
                color: (r[1] || '').replace(/"/g, '').trim(),
                price: priceNum
              });
            }
          }
          setZipQualityData(parsed);
        }
      } catch (err) {
        console.warn("Failed to fetch zip quality data from Google Sheet:", err);
      }
    };
    loadZipData();
  }, []);

  // Fetch all categories from database
  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const hostname = window.location.hostname;

      // 1. Fetch Standard POs
      const poRes = await fetch(`${getBackendUrl()}/api/pos`);
      if (poRes.ok) {
        const posData = await poRes.json();
        posData.sort((a, b) => b.poNumber.localeCompare(a.poNumber));
        setPoList(posData);
      }

      // 2. Fetch Zip PO cutting headers
      const zipRes = await fetch(`${getBackendUrl()}/api/cutting-headers`);
      if (zipRes.ok) {
        const zipData = await zipRes.json();
        zipData.sort((a, b) => (b.Lot_Number || '').localeCompare(a.Lot_Number || ''));
        setZipPoList(zipData);
      }

      // 3. Fetch Dori PO orders
      const doriRes = await fetch(`${getBackendUrl()}/api/doori-orders`);
      if (doriRes.ok) {
        const doriData = await doriRes.json();
        doriData.sort((a, b) => (b.Lot_Number || '').localeCompare(a.Lot_Number || ''));
        setDoriPoList(doriData);
      }

      // 4. Fetch RGP scans (scan_type = 'rgp_entry')
      const scansRes = await fetch(`${getBackendUrl()}/api/scans`);
      if (scansRes.ok) {
        const scansData = await scansRes.json();
        const rgps = scansData
          .filter(s => s.scan_type === 'rgp_entry')
          .map(s => {
            if (s.rgp_payload) {
              try {
                return JSON.parse(s.rgp_payload);
              } catch (err) {
                // fallback to reconstruction below
              }
            }
            return {
              rgpNo: s.lot_number || `RGP-${s.id}`,
              date: formatDateSafe(s.scanned_at),
              vendor: s.supplier_name || 'N/A',
              rgpType: s.material_name && s.material_name.toLowerCase().includes('dori') ? 'Dori Processing' : 'Fabric Dyeing/Embroidery',
              purpose: s.material_name || 'Material Processing',
              vehicleNo: 'N/A',
              preparedBy: s.person_name || 'System',
              entries: [
                {
                  srNo: 1,
                  lotNo: (s.lot_number || '').replace('RGP-TEMP-', '').replace('RGP-', ''),
                  itemDesc: s.material_name || 'Material Entry',
                  qty1: s.quantity || 1,
                  uom: 'PCS'
                }
              ]
            };
          })
          .filter(Boolean);

        rgps.sort((a, b) => (b.rgpNo || '').localeCompare(a.rgpNo || ''));
        setRgpList(rgps);
      }
    } catch (err) {
      console.error("Failed to load documents archive:", err);
      setError("Could not retrieve documents archive. Verify that database backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Reset selected document when active tab changes
  useEffect(() => {
    setSelectedDocId(null);
  }, [activeSubTab]);

  // Filter lists based on search query
  const filteredPOs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return poList;
    return poList.filter(po =>
      (po.poNumber || '').toLowerCase().includes(q) ||
      (po.vendorName || '').toLowerCase().includes(q) ||
      (po.designName || '').toLowerCase().includes(q)
    );
  }, [poList, searchQuery]);

  const filteredZipPOs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return zipPoList;
    return zipPoList.filter(po =>
      (po.Lot_Number || '').toLowerCase().includes(q) ||
      (po.Supervisor || '').toLowerCase().includes(q) ||
      (po.Style || '').toLowerCase().includes(q) ||
      (po.Garment_Type || '').toLowerCase().includes(q)
    );
  }, [zipPoList, searchQuery]);

  const filteredDoriPOs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return doriPoList;
    return doriPoList.filter(po =>
      (po.Lot_Number || '').toLowerCase().includes(q) ||
      (po.Supervisor || '').toLowerCase().includes(q) ||
      (po.Style || '').toLowerCase().includes(q) ||
      (po.Garment_Type || '').toLowerCase().includes(q)
    );
  }, [doriPoList, searchQuery]);

  const filteredRGPs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rgpList;
    return rgpList.filter(rgp =>
      (rgp.rgpNo || '').toLowerCase().includes(q) ||
      (rgp.vendor || '').toLowerCase().includes(q) ||
      (rgp.rgpType || '').toLowerCase().includes(q) ||
      (rgp.purpose || '').toLowerCase().includes(q)
    );
  }, [rgpList, searchQuery]);

  // Selected document data mapping
  const selectedDoc = useMemo(() => {
    if (activeSubTab === 'po') {
      return poList.find(po => po.poNumber === selectedDocId) || poList[0] || null;
    } else if (activeSubTab === 'zip') {
      return zipPoList.find(po => po.Lot_Number === selectedDocId) || zipPoList[0] || null;
    } else if (activeSubTab === 'dori') {
      return doriPoList.find(po => po.Lot_Number === selectedDocId) || doriPoList[0] || null;
    } else {
      return rgpList.find(rgp => rgp.rgpNo === selectedDocId) || rgpList[0] || null;
    }
  }, [activeSubTab, poList, zipPoList, doriPoList, rgpList, selectedDocId]);

  // Select first item by default
  useEffect(() => {
    if (selectedDoc && !selectedDocId) {
      if (activeSubTab === 'po') setSelectedDocId(selectedDoc.poNumber);
      else if (activeSubTab === 'zip') setSelectedDocId(selectedDoc.Lot_Number);
      else if (activeSubTab === 'dori') setSelectedDocId(selectedDoc.Lot_Number);
      else setSelectedDocId(selectedDoc.rgpNo);
    }
  }, [selectedDoc, selectedDocId, activeSubTab]);

  const [activeMatrix, setActiveMatrix] = useState(null);

  // Fetch Matrix Helper
  const fetchMatrix = async (lotNo) => {
    try {
      const hostname = window.location.hostname;
      const res = await fetch(`${getBackendUrl()}/api/cutting/${lotNo}`);
      if (res.ok) {
        const data = await res.json();
        const sizeKeys = ['M', 'L', 'XL', 'XXL'];

        const totals = { perSize: {}, grand: 0 };
        for (const k of sizeKeys) totals.perSize[k] = 0;
        for (const row of data.rows || []) {
          totals.grand += row.totalPcs || 0;
          for (const k of sizeKeys) {
            totals.perSize[k] += row.sizes?.[k] ?? 0;
          }
        }

        return {
          lotNumber: data.lotNumber,
          style: data.style,
          fabric: data.fabric,
          garmentType: data.garmentType,
          brand: data.brand,
          partyName: data.partyName,
          sizes: sizeKeys,
          rows: data.rows || [],
          totals,
          source: 'cutting'
        };
      }
    } catch (err) {
      console.error("Failed to fetch matrix for lot:", lotNo, err);
    }
    return null;
  };

  const reconstructMatrixFromPo = (po, type) => {
    if (!po) return null;
    let selections = {};
    try {
      if (type === 'dori' && po.Dori_Selections) {
        selections = typeof po.Dori_Selections === 'string' ? JSON.parse(po.Dori_Selections) : po.Dori_Selections;
      } else if (type === 'zip' && po.zip_payload) {
        const payload = typeof po.zip_payload === 'string' ? JSON.parse(po.zip_payload) : po.zip_payload;
        selections = payload.zipSelections || {};
      }
    } catch (_) { }

    const rows = [];
    let grandTotal = 0;

    // Attempt 1: Parse po.Color_Breakdown
    if (po.Color_Breakdown) {
      const parts = po.Color_Breakdown.split(';');
      parts.forEach(part => {
        const match = part.match(/^\s*([^:]+):\s*(\d+)\s*pcs/i);
        if (match) {
          const colorName = match[1].trim();
          const pcs = parseInt(match[2], 10) || 0;
          rows.push({
            color: colorName,
            totalPcs: pcs,
            sizes: { M: 0, L: 0, XL: 0, XXL: 0 }
          });
          grandTotal += pcs;
        }
      });
    }

    // Attempt 2: If Zip PO, parse po.Shades
    if (rows.length === 0 && type === 'zip' && po.Shades) {
      const shadesList = po.Shades.split(',').map(s => s.trim()).filter(Boolean);
      const totalQty = po.Cutting_Qty || po.Total_Pieces || 0;
      const pcsPerShade = shadesList.length > 0 ? Math.round(totalQty / shadesList.length) : 0;

      shadesList.forEach(shade => {
        rows.push({
          color: shade,
          totalPcs: pcsPerShade,
          sizes: { M: 0, L: 0, XL: 0, XXL: 0 }
        });
      });
      grandTotal = totalQty;
    }

    // Fallback 1: If still empty, use selections keys
    if (rows.length === 0) {
      const keys = Object.keys(selections);
      const totalQty = po.Total_Pieces || po.Cutting_Qty || 0;
      const pcsPerColor = keys.length > 0 ? Math.round(totalQty / keys.length) : 0;

      keys.forEach(colorName => {
        rows.push({
          color: colorName,
          totalPcs: pcsPerColor,
          sizes: { M: 0, L: 0, XL: 0, XXL: 0 }
        });
      });
      grandTotal = totalQty;
    }

    // Fallback 2: If still empty, add a default row
    if (rows.length === 0) {
      rows.push({
        color: 'DEFAULT',
        totalPcs: po.Total_Pieces || po.Cutting_Qty || 100,
        sizes: { M: 0, L: 0, XL: 0, XXL: 0 }
      });
      grandTotal = po.Total_Pieces || po.Cutting_Qty || 100;
    }

    return {
      lotNumber: po.Lot_Number,
      style: po.Style || 'N/A',
      fabric: po.Fabric || 'N/A',
      garmentType: po.Garment_Type || 'N/A',
      brand: po.Brand || 'N/A',
      partyName: po.Party_Name || 'N/A',
      sizes: ['M', 'L', 'XL', 'XXL'],
      rows: rows,
      totals: {
        perSize: { M: 0, L: 0, XL: 0, XXL: 0 },
        grand: grandTotal
      }
    };
  };

  useEffect(() => {
    if (!selectedDocId || (activeSubTab !== 'zip' && activeSubTab !== 'dori')) {
      setActiveMatrix(null);
      return;
    }
    const loadMatrix = async () => {
      const matrix = await fetchMatrix(selectedDocId);
      if (matrix) {
        setActiveMatrix(matrix);
      } else {
        const reconstructed = reconstructMatrixFromPo(selectedDoc, activeSubTab);
        setActiveMatrix(reconstructed);
      }
    };
    loadMatrix();
  }, [selectedDocId, activeSubTab, selectedDoc]);

  // PDF Re-download Actions
  const handleDownloadPO = async (po) => {
    setDownloadingId(po.poNumber);
    try {
      const hostname = window.location.hostname;
      const isLocalHostOrIP =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.');

      let localSystemUrl = `${window.location.origin}/`;
      if (isLocalHostOrIP) {
        let serverIp = hostname;
        try {
          const res = await fetch(`${getBackendUrl()}/api/public/server-ip`);
          if (res.ok) {
            const data = await res.json();
            if (data.ip) serverIp = data.ip;
          }
        } catch (ipErr) {
          console.warn("Failed to fetch server IP:", ipErr);
        }
        const port = window.location.port ? `:${window.location.port}` : '';
        localSystemUrl = `http://${serverIp}${port}/`;
      }

      const { gateUrl, recvUrl } = buildPoQrUrls({
        base: localSystemUrl,
        poNo: po.poNumber,
        orderDate: po.date,
        expectedDate: po.deliveryDate,
        supervisorName: po.approvedBy || po.preparedBy || 'Supervisor',
      });

      const [gateQR, recvQR] = await Promise.all([
        toDataURL_QR(gateUrl, 320),
        toDataURL_QR(recvUrl, 320)
      ]);

      const payload = {
        meta: {
          poNumber: po.poNumber,
          orderDate: po.date,
          orderTime: "10:00",
          expectedDate: po.deliveryDate,
          expectedTime: "",
          requisitionRaisedBy: po.requisitionRaisedBy || "N/A",
          preparedBy: po.preparedBy || "N/A",
          approvedBy: po.approvedBy || "N/A",
          remarks: po.remarks || "",
        },
        supplierName: po.vendorName,
        supplierAddress: po.vendorAddress || "",
        supplierEmail: po.vendorEmail || "",
        supplierPhone: po.vendorPhone || "",
        rows: Array.isArray(po.items) ? po.items.map((it, idx) => ({
          line: idx + 1,
          department: it.department || "Production",
          description: it.name,
          shade: it.description || "",
          uom: it.unit || "PCS",
          qty: it.qty,
          rate: it.price,
          amount: it.qty * it.price
        })) : [],
        totals: {
          sub: po.subtotal,
          gstAmount: po.tax,
          grandTotal: po.total
        }
      };

      const doc = generatePurchaseOrderPDF({
        payload,
        options: {
          qrGateImage: gateQR,
          qrRecvImage: recvQR,
          qrSide: 96,
          shadeEnabled: true,
          gstEnabled: po.taxRate > 0,
          gstPercentage: po.taxRate || 0
        }
      });

      downloadPdfBlob(doc, `${po.poNumber}.pdf`);
    } catch (err) {
      console.error("PO PDF compile error:", err);
      alert("Error generating PO PDF: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadZipPO = async (po) => {
    setDownloadingId(po.Lot_Number);
    try {
      let matrix = activeMatrix;
      if (!matrix) {
        matrix = await fetchMatrix(po.Lot_Number);
        if (!matrix) {
          matrix = reconstructMatrixFromPo(po, 'zip');
        }
      }

      if (matrix && (!matrix.totals || typeof matrix.totals.grand === 'undefined' || !matrix.sizes)) {
        const sizeKeys = ['M', 'L', 'XL', 'XXL'];
        const totals = { perSize: {}, grand: 0 };
        for (const k of sizeKeys) totals.perSize[k] = 0;
        for (const row of matrix.rows || []) {
          totals.grand += row.totalPcs || 0;
          for (const k of sizeKeys) {
            totals.perSize[k] += row.sizes?.[k] ?? 0;
          }
        }
        matrix.totals = totals;
        matrix.sizes = sizeKeys;
      }

      let options;
      if (po.zip_payload) {
        options = JSON.parse(po.zip_payload);
      } else {
        // Build fallback configuration options
        const zipSelections = {};
        matrix.rows.forEach(r => {
          zipSelections[r.color] = r.color.toLowerCase() === 'black' ? 'Black' : 'Coloured';
        });
        options = {
          issueDate: po.Date_of_Issue || po.Saved_At || new Date().toLocaleDateString('en-GB'),
          supervisor: po.Supervisor || 'Supervisor',
          priority: po.Priority || 'Normal',
          zipSelections,
          selectedPlacements: po.Sticker ? [po.Sticker] : ['DEFAULT'],
          placementQuantities: { [po.Sticker || 'DEFAULT']: 1 },
          placementZipTypes: { [po.Sticker || 'DEFAULT']: 'DEFAULT' },
          zipQualityData,
          blockedShades: new Set()
        };
      }

      await generateZipIssuePdf(matrix, options);
    } catch (err) {
      console.error("Zip PO PDF compile error:", err);
      alert("Error generating Zip PO PDF: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadDoriPO = async (po) => {
    setDownloadingId(po.Lot_Number);
    try {
      let matrix = activeMatrix;
      if (!matrix) {
        matrix = await fetchMatrix(po.Lot_Number);
        if (!matrix) {
          matrix = reconstructMatrixFromPo(po, 'dori');
        }
      }

      if (matrix && (!matrix.totals || typeof matrix.totals.grand === 'undefined' || !matrix.sizes)) {
        const sizeKeys = ['M', 'L', 'XL', 'XXL'];
        const totals = { perSize: {}, grand: 0 };
        for (const k of sizeKeys) totals.perSize[k] = 0;
        for (const row of matrix.rows || []) {
          totals.grand += row.totalPcs || 0;
          for (const k of sizeKeys) {
            totals.perSize[k] += row.sizes?.[k] ?? 0;
          }
        }
        matrix.totals = totals;
        matrix.sizes = sizeKeys;
      }

      let options;
      if (po.dori_payload) {
        options = JSON.parse(po.dori_payload);
      } else {
        // Build fallback configuration options
        const zipSelections = {};
        matrix.rows.forEach(r => {
          zipSelections[r.color] = r.color.toLowerCase() === 'black' ? 'Black' : 'Coloured';
        });

        let placements = ['DEFAULT'];
        try {
          if (po.Selected_Placements) placements = JSON.parse(po.Selected_Placements);
        } catch (_) { }

        options = {
          issueDate: po.Issue_Date || po.Timestamp || new Date().toLocaleDateString('en-GB'),
          supervisor: po.Supervisor || 'Supervisor',
          priority: 'Normal',
          zipSelections,
          selectedPlacements: placements,
          placementQuantities: po.Placement_Quantities ? JSON.parse(po.Placement_Quantities) : { 'DEFAULT': 1 },
          placementZipTypes: po.Placement_Dori_Types ? JSON.parse(po.Placement_Dori_Types) : { 'DEFAULT': 'DEFAULT' },
          zipQualityData: [],
          blockedShades: new Set()
        };
      }

      await generateDoriIssuePdf(matrix, options);
    } catch (err) {
      console.error("Dori PO PDF compile error:", err);
      alert("Error generating Dori PO PDF: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadRGP = async (rgp) => {
    setDownloadingId(rgp.rgpNo);
    try {
      const hostname = window.location.hostname;
      const isLocalHostOrIP =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.');

      let localSystemUrl = `${window.location.origin}/`;
      if (isLocalHostOrIP) {
        let serverIp = hostname;
        try {
          const res = await fetch(`${getBackendUrl()}/api/public/server-ip`);
          if (res.ok) {
            const data = await res.json();
            if (data.ip) serverIp = data.ip;
          }
        } catch (ipErr) {
          console.warn("Failed to fetch server IP:", ipErr);
        }
        const port = window.location.port ? `:${window.location.port}` : '';
        localSystemUrl = `http://${serverIp}${port}/`;
      }

      const entryUrl = `${localSystemUrl}?action=rgpEntryForm&rgp=${encodeURIComponent(rgp.rgpNo)}`;
      const returnUrl = `${localSystemUrl}?action=rgpReturnForm&rgp=${encodeURIComponent(rgp.rgpNo)}`;
      const gateUrl = `${localSystemUrl}?action=gateForm&rgp=${encodeURIComponent(rgp.rgpNo)}`;

      let entryQR, returnQR, gateQR;
      try { entryQR = await generateQRCode(entryUrl); } catch (qrError) { console.error("Failed to generate entry QR:", qrError); }
      try { returnQR = await generateQRCode(returnUrl); } catch (qrError) { console.error("Failed to generate return QR:", qrError); }
      try { gateQR = await generateQRCode(gateUrl); } catch (qrError) { console.error("Failed to generate gate QR:", qrError); }

      const pdfDoc = generateRgpPDF({
        payload: rgp,
        options: { qrEntryImage: entryQR, qrReturnImage: returnQR, qrGateImage: gateQR }
      });

      pdfDoc.save(`RGP-${rgp.rgpNo}.pdf`);
    } catch (err) {
      console.error("RGP PDF compile error:", err);
      alert("Error generating RGP PDF: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div style={{ padding: '0 0 40px 0', fontFamily: 'var(--font-family-body, sans-serif)' }}>
      {/* Header Info */}
      <div className="Header" style={{ marginBottom: '24px' }}>
        <h2 className="Title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '24px', fontWeight: '800' }}>
          <Download size={28} style={{ color: 'var(--accent-color)' }} />
          Re-Download Documents Center
        </h2>
        <p className="SubTitle" style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Browse history logs, view summaries, and download physical print copies of standard Purchase Orders (POs), Zip/Dori Trim POs, and Gate Passes (RGPs).
        </p>
      </div>

      {/* Styled Segmented Sub-Tab Switcher */}
      <div style={{
        maxWidth: '640px',
        marginBottom: '28px',
        display: 'flex',
        background: 'var(--bg-primary, #f8fafc)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '12px',
        padding: '4px',
        gap: '4px'
      }}>
        {[
          { id: 'po', label: 'Standard PO', icon: <FileText size={16} /> },
          { id: 'zip', label: 'Zip Purcharge Orders', icon: <Layers size={16} /> },
          { id: 'dori', label: 'Dori Purcharge Orders', icon: <Scissors size={16} /> },
          { id: 'rgp', label: 'Returnable Gate Pass', icon: <Truck size={16} /> }
        ].map(tab => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: 'none',
                background: isActive ? 'var(--accent-color, #6366f1)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-muted, #64748b)',
                boxShadow: isActive ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-main, #0f172a)';
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-muted, #64748b)';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading & Error Boundary */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px', color: 'var(--text-muted)' }}>
          <RefreshCw className="spin-animation" size={20} />
          <span>Refreshing database records...</span>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: '12px', color: 'var(--danger)', marginBottom: '20px' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchDocuments} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontWeight: '600' }}>Retry</button>
        </div>
      )}

      {/* Main Split Layout */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>

          {/* LEFT COLUMN: Search & List Panel */}
          <div className="panel" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.01)' }}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder={
                  activeSubTab === 'po' ? "Search PO No, Vendor or design..." :
                    activeSubTab === 'zip' ? "Search Lot No, Supervisor or style..." :
                      activeSubTab === 'dori' ? "Search Lot No, Supervisor or style..." :
                        "Search RGP No, Vendor or type..."
                }
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 36px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border-color, #e2e8f0)',
                  background: 'var(--bg-primary, #f8fafc)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Scrollable list */}
            <div style={{ maxHeight: '550px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {activeSubTab === 'po' && (
                filteredPOs.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No Purchase Orders found.</div>
                ) : (
                  filteredPOs.map(po => (
                    <div
                      key={po.poNumber}
                      onClick={() => setSelectedDocId(po.poNumber)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1.5px solid',
                        borderColor: selectedDocId === po.poNumber ? 'var(--accent-color, #6366f1)' : 'var(--border-color, #e2e8f0)',
                        background: selectedDocId === po.poNumber ? 'var(--accent-light, rgba(99, 102, 241, 0.04))' : 'var(--bg-secondary, #ffffff)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: selectedDocId === po.poNumber ? 'var(--accent-color, #6366f1)' : 'var(--text-main)' }}>
                          {po.poNumber}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                          {po.vendorName}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: selectedDocId === po.poNumber ? 'var(--accent-color)' : 'var(--text-light)' }} />
                    </div>
                  ))
                )
              )}

              {activeSubTab === 'zip' && (
                filteredZipPOs.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No Zip Purchase Orders found.</div>
                ) : (
                  filteredZipPOs.map(po => (
                    <div
                      key={po.Lot_Number}
                      onClick={() => setSelectedDocId(po.Lot_Number)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1.5px solid',
                        borderColor: selectedDocId === po.Lot_Number ? 'var(--accent-color, #6366f1)' : 'var(--border-color, #e2e8f0)',
                        background: selectedDocId === po.Lot_Number ? 'var(--accent-light, rgba(99, 102, 241, 0.04))' : 'var(--bg-secondary, #ffffff)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: selectedDocId === po.Lot_Number ? 'var(--accent-color, #6366f1)' : 'var(--text-main)' }}>
                          Lot No: {po.Lot_Number}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                          {po.Garment_Type} {po.Supervisor ? `• ${po.Supervisor}` : ''}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: selectedDocId === po.Lot_Number ? 'var(--accent-color)' : 'var(--text-light)' }} />
                    </div>
                  ))
                )
              )}

              {activeSubTab === 'dori' && (
                filteredDoriPOs.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No Dori Purchase Orders found.</div>
                ) : (
                  filteredDoriPOs.map(po => (
                    <div
                      key={po.Lot_Number}
                      onClick={() => setSelectedDocId(po.Lot_Number)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1.5px solid',
                        borderColor: selectedDocId === po.Lot_Number ? 'var(--accent-color, #6366f1)' : 'var(--border-color, #e2e8f0)',
                        background: selectedDocId === po.Lot_Number ? 'var(--accent-light, rgba(99, 102, 241, 0.04))' : 'var(--bg-secondary, #ffffff)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: selectedDocId === po.Lot_Number ? 'var(--accent-color, #6366f1)' : 'var(--text-main)' }}>
                          Lot No: {po.Lot_Number}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                          {po.Garment_Type} {po.Supervisor ? `• ${po.Supervisor}` : ''}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: selectedDocId === po.Lot_Number ? 'var(--accent-color)' : 'var(--text-light)' }} />
                    </div>
                  ))
                )
              )}

              {activeSubTab === 'rgp' && (
                filteredRGPs.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No Returnable Gate Passes found.</div>
                ) : (
                  filteredRGPs.map(rgp => (
                    <div
                      key={rgp.rgpNo}
                      onClick={() => setSelectedDocId(rgp.rgpNo)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1.5px solid',
                        borderColor: selectedDocId === rgp.rgpNo ? 'var(--accent-color, #6366f1)' : 'var(--border-color, #e2e8f0)',
                        background: selectedDocId === rgp.rgpNo ? 'var(--accent-light, rgba(99, 102, 241, 0.04))' : 'var(--bg-secondary, #ffffff)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: selectedDocId === rgp.rgpNo ? 'var(--accent-color, #6366f1)' : 'var(--text-main)' }}>
                          {rgp.rgpNo}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                          {rgp.vendor} ({rgp.rgpType})
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: selectedDocId === rgp.rgpNo ? 'var(--accent-color)' : 'var(--text-light)' }} />
                    </div>
                  ))
                )
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Document Detail & Re-download panel */}
          <div className="panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.01)', minHeight: '500px' }}>
            {selectedDoc ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>

                {/* Upper Metadata area */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>
                        {activeSubTab === 'po' ? selectedDoc.poNumber :
                          activeSubTab === 'zip' || activeSubTab === 'dori' ? `Lot: ${selectedDoc.Lot_Number}` :
                            selectedDoc.rgpNo}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={14} />
                          {activeSubTab === 'po' ? selectedDoc.date :
                            activeSubTab === 'zip' ? (selectedDoc.Date_of_Issue || selectedDoc.Saved_At) :
                              activeSubTab === 'dori' ? (selectedDoc.Issue_Date || selectedDoc.Timestamp) :
                                selectedDoc.date}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={14} />
                          Supervisor: {activeSubTab === 'po' ? (selectedDoc.approvedBy || selectedDoc.preparedBy || 'N/A') :
                            activeSubTab === 'zip' || activeSubTab === 'dori' ? (selectedDoc.Supervisor || 'N/A') :
                              (selectedDoc.preparedBy || 'N/A')}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      padding: '6px 14px',
                      borderRadius: '30px',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: 'rgba(16, 185, 129, 0.08)',
                      color: 'var(--success, #10b981)',
                      border: '1.5px solid var(--success, #10b981)'
                    }}>
                      {activeSubTab === 'po' ? (selectedDoc.status || 'Issued') :
                        activeSubTab === 'zip' || activeSubTab === 'dori' ? 'Approved' : 'Outward'}
                    </div>
                  </div>

                  {/* Attributes Dashboard Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ padding: '14px', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Article Style</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', marginTop: '4px', color: 'var(--text-main)' }}>
                        {activeSubTab === 'po' ? selectedDoc.designName :
                          activeSubTab === 'zip' || activeSubTab === 'dori' ? selectedDoc.Style :
                            selectedDoc.purpose}
                      </div>
                    </div>
                    <div style={{ padding: '14px', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                        {activeSubTab === 'rgp' ? 'Gate Pass Type' : 'Garment Category'}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', marginTop: '4px', color: 'var(--text-main)', textTransform: 'uppercase' }}>
                        {activeSubTab === 'po' ? selectedDoc.designCategory :
                          activeSubTab === 'zip' || activeSubTab === 'dori' ? selectedDoc.Garment_Type :
                            selectedDoc.rgpType}
                      </div>
                    </div>
                    <div style={{ padding: '14px', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                        {activeSubTab === 'po' ? 'Grand Total' :
                          activeSubTab === 'zip' ? 'Cutting Qty' :
                            activeSubTab === 'dori' ? 'Total Pieces' : 'Items Count'}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', marginTop: '4px', color: 'var(--text-main)' }}>
                        {activeSubTab === 'po' && `${currencySymbol} ${selectedDoc.total ? selectedDoc.total.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}`}
                        {activeSubTab === 'zip' && `${selectedDoc.Cutting_Qty || selectedDoc.Stitching_Issue_Qty || 0} Pcs`}
                        {activeSubTab === 'dori' && `${selectedDoc.Total_Pieces || 0} Pcs`}
                        {activeSubTab === 'rgp' && `${Array.isArray(selectedDoc.entries) ? selectedDoc.entries.length : 1} Line(s)`}
                      </div>
                    </div>
                  </div>

                  {/* Summary of Items list */}
                  <h4 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '10px', color: 'var(--text-main)' }}>Document Material Items</h4>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
                    <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 14px' }}>#</th>
                          <th style={{ padding: '10px 14px' }}>Description</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Qty</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center' }}>UOM</th>
                          {activeSubTab === 'po' && <th style={{ padding: '10px 14px', textAlign: 'right' }}>Rate</th>}
                          {activeSubTab === 'po' && <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {activeSubTab === 'po' && (
                          Array.isArray(selectedDoc.items) && selectedDoc.items.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                                {it.name} {it.description ? <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>({it.description})</span> : ''}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>{it.qty}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', textTransform: 'uppercase' }}>{it.unit || 'PCS'}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>{currencySymbol} {it.price ? it.price.toFixed(2) : '0.00'}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600' }}>{currencySymbol} {(it.qty * it.price).toFixed(2)}</td>
                            </tr>
                          ))
                        )}

                        {activeSubTab === 'zip' && (
                          activeMatrix && activeMatrix.rows ? (
                            activeMatrix.rows.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                                  Zipper Trim - {row.color}
                                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400', marginTop: '2px' }}>
                                    Placement: {selectedDoc.Sticker || 'DEFAULT'} • Fabric: {selectedDoc.Fabric || 'N/A'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.totalPcs || 0}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>PCS</td>
                              </tr>
                            ))
                          ) : (
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>1</td>
                              <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                                Zipper Trims (Lot Ref Matrix)
                                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400', marginTop: '2px' }}>
                                  Placement: {selectedDoc.Sticker || 'DEFAULT'} • Fabric: {selectedDoc.Fabric}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>{selectedDoc.Cutting_Qty || 0}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>PCS</td>
                            </tr>
                          )
                        )}

                        {activeSubTab === 'dori' && (
                          activeMatrix && activeMatrix.rows ? (
                            activeMatrix.rows.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                                  Drawstring (Dori) - {row.color}
                                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400', marginTop: '2px' }}>
                                    Placements: {(() => {
                                      try {
                                        return selectedDoc.Selected_Placements ? JSON.parse(selectedDoc.Selected_Placements).join(', ') : 'DEFAULT';
                                      } catch (_) {
                                        return selectedDoc.Selected_Placements || 'DEFAULT';
                                      }
                                    })()}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.totalPcs || 0}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>PCS</td>
                              </tr>
                            ))
                          ) : (
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>1</td>
                              <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                                Drawstrings (Dori Purcharge Orders Matrix)
                                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400', marginTop: '2px' }}>
                                  Placements: {(() => {
                                    try {
                                      return selectedDoc.Selected_Placements ? JSON.parse(selectedDoc.Selected_Placements).join(', ') : 'DEFAULT';
                                    } catch (_) {
                                      return selectedDoc.Selected_Placements || 'DEFAULT';
                                    }
                                  })()}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>{selectedDoc.Total_Pieces || 0}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>PCS</td>
                            </tr>
                          )
                        )}

                        {activeSubTab === 'rgp' && (
                          Array.isArray(selectedDoc.entries) && selectedDoc.entries.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                                {it.itemDesc || `Lot No Reference: ${it.lotNo}`}
                                {it.lotNo && it.itemDesc ? <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}> (Lot: {it.lotNo})</span> : ''}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>{it.qty1}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', textTransform: 'uppercase' }}>{it.uom || 'PCS'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Compile and Download Button */}
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (activeSubTab === 'po') handleDownloadPO(selectedDoc);
                    else if (activeSubTab === 'zip') handleDownloadZipPO(selectedDoc);
                    else if (activeSubTab === 'dori') handleDownloadDoriPO(selectedDoc);
                    else handleDownloadRGP(selectedDoc);
                  }}
                  disabled={downloadingId === (
                    activeSubTab === 'po' ? selectedDoc.poNumber :
                      activeSubTab === 'zip' || activeSubTab === 'dori' ? selectedDoc.Lot_Number :
                        selectedDoc.rgpNo
                  )}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {downloadingId === (
                    activeSubTab === 'po' ? selectedDoc.poNumber :
                      activeSubTab === 'zip' || activeSubTab === 'dori' ? selectedDoc.Lot_Number :
                        selectedDoc.rgpNo
                  ) ? (
                    <>
                      <RefreshCw className="spin-animation" size={18} />
                      <span>Generating PDF Document...</span>
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      <span>Re-Download Document PDF</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '12px' }}>
                <FileText size={48} style={{ opacity: 0.3 }} />
                <span>Select a document from the list to view details and re-download.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Local spinner rotation animation style */}
      <style>{`
        .spin-animation {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
