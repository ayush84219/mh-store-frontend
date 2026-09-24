import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Clock, User, ClipboardList, CheckCircle, XCircle,
  Scissors, Shuffle, Truck, QrCode, ShieldCheck, AlertCircle, FileText, Check, Download,
  BarChart3, TrendingUp, Activity
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatDateTime = (dateVal) => {
  if (!dateVal) return '';
  const str = String(dateVal).trim();

  // Handle dd/mm/yyyy hh:mm or dd/mm/yyyy
  const dmyRegex = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?(?:\s*(AM|PM))?/i;
  const match = str.match(dmyRegex);

  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    const hour = match[4];
    const minute = match[5];
    const ampm = match[6];

    if (hour && minute) {
      if (ampm) {
        return `${day}/${month}/${year} ${hour.padStart(2, '0')}:${minute} ${ampm.toUpperCase()}`;
      }
      let hr = parseInt(hour, 10);
      const calculatedAmPm = hr >= 12 ? 'PM' : 'AM';
      hr = hr % 12;
      hr = hr ? hr : 12;
      return `${day}/${month}/${year} ${String(hr).padStart(2, '0')}:${minute} ${calculatedAmPm}`;
    }
    return `${day}/${month}/${year}`;
  }

  // Try JS standard Date parsing
  try {
    const parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).replace(',', '');
    }
  } catch (e) { }

  return str;
};

const parseToDateObject = (dateVal) => {
  if (!dateVal) return new Date(0);

  // Handle string like 'Fri Sep 19 2025 15:42:22 GMT...' or ISO strings
  const parsed = new Date(dateVal);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  const str = String(dateVal).trim();
  const dmyRegex = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?(?:\s*(AM|PM))?/i;
  const match = str.match(dmyRegex);

  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    let hour = match[4] ? parseInt(match[4], 10) : 0;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    const ampm = match[6];

    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
    }

    return new Date(year, month, day, hour, minute);
  }

  return new Date(0);
};

export default function HistoryView({ designs = [], currencySymbol = 'R', currentUser }) {
  const [selectedLotId, setSelectedLotId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [ageSort, setAgeSort] = useState('newest');
  const [dateFilter, setDateFilter] = useState('all');
  const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' or 'chronological'

  // Data lists fetched from backend
  const [historyLogs, setHistoryLogs] = useState([]);
  const [scanLogs, setScanLogs] = useState([]);
  const [cuttingHeaders, setCuttingHeaders] = useState([]);
  const [dooriOrders, setDooriOrders] = useState([]);
  const [zipOrders, setZipOrders] = useState([]);
  const [pos, setPOs] = useState([]);
  const [issueLogs, setIssueLogs] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [extraMaterialIssues, setExtraMaterialIssues] = useState([]);
  const [weightCaptures, setWeightCaptures] = useState([]);

  // Loading & error states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch all history data from backend on mount
  useEffect(() => {
    const fetchHistoryData = async () => {
      setIsLoading(true);
      setErrorMessage('');
      const backendUrl = getBackendUrl();

      try {
        const [historyRes, scansRes, headersRes, dooriRes, zipRes, posRes, issueRes, transferRes, extraRes, weightRes] = await Promise.all([
          fetch(`${backendUrl}/api/design-history`),
          fetch(`${backendUrl}/api/scans`),
          fetch(`${backendUrl}/api/cutting-headers`),
          fetch(`${backendUrl}/api/doori-orders`),
          fetch(`${backendUrl}/api/zip-orders`),
          fetch(`${backendUrl}/api/pos`),
          fetch(`${backendUrl}/api/issue-logs`),
          fetch(`${backendUrl}/api/transfers`),
          fetch(`${backendUrl}/api/extra-material-issues`),
          fetch(`${backendUrl}/api/weight-capture`)
        ]);

        if (historyRes.ok) setHistoryLogs(await historyRes.json());
        if (scansRes.ok) setScanLogs(await scansRes.json());
        if (headersRes.ok) setCuttingHeaders(await headersRes.json());
        if (dooriRes.ok) setDooriOrders(await dooriRes.json());
        if (zipRes.ok) setZipOrders(await zipRes.json());
        if (posRes.ok) setPOs(await posRes.json());
        if (issueRes.ok) setIssueLogs(await issueRes.json());
        if (transferRes && transferRes.ok) setTransfers(await transferRes.json());
        if (extraRes && extraRes.ok) setExtraMaterialIssues(await extraRes.json());
        if (weightRes && weightRes.ok) {
          const wData = await weightRes.json();
          setWeightCaptures(wData.success && Array.isArray(wData.data) ? wData.data : (Array.isArray(wData) ? wData : []));
        }
      } catch (err) {
        console.error('Failed to load history lists:', err);
        setErrorMessage('Failed to connect to the backend server. Make sure port 5000 is running.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistoryData();
  }, []);

  const lotOptions = useMemo(() => {
    const set = new Set();
    designs.forEach(d => { if (d.id) set.add(String(d.id).trim()); });
    cuttingHeaders.forEach(h => { if (h.Lot_Number) set.add(String(h.Lot_Number).trim()); });
    dooriOrders.forEach(o => { if (o.Lot_Number) set.add(String(o.Lot_Number).trim()); });
    zipOrders.forEach(z => { if (z.Lot_Number) set.add(String(z.Lot_Number).trim()); });
    scanLogs.forEach(s => { if (s.lot_number) set.add(String(s.lot_number).trim()); });
    pos.forEach(p => {
      if (p.poNumber) set.add(String(p.poNumber).trim());
      if (p.designName) set.add(String(p.designName).trim());
    });
    return Array.from(set).filter(Boolean).sort();
  }, [designs, cuttingHeaders, dooriOrders, zipOrders, scanLogs, pos]);

  // Filter approved/verification lot list for selection
  const filteredLotsList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    // Build a list of objects representing each lot ID/PO number
    let list = lotOptions.map(id => {
      // Find matching design if any
      const d = designs.find(des => String(des.id).toLowerCase() === String(id).toLowerCase());
      // Find matching PO if any (to resolve PO name)
      const po = pos.find(p => String(p.poNumber).toLowerCase() === String(id).toLowerCase());

      return {
        id: id,
        style: d ? d.style : (po ? 'Purchase Order' : 'External Run'),
        brand: d ? d.brand : (po ? po.vendorName : 'N/A'),
        category: d ? d.category : 'Trims/Accessory',
        imageUrl: d ? d.imageUrl : null,
        date: d ? (d.created_at || d.date) : (po ? po.date : '')
      };
    });

    // 1. Filter by Design Type (Original vs Version)
    if (typeFilter === 'original') {
      list = list.filter(item => !String(item.id).includes('-V'));
    } else if (typeFilter === 'version') {
      list = list.filter(item => String(item.id).includes('-V'));
    }

    // 2. Filter by Date range
    if (dateFilter !== 'all') {
      const now = new Date();
      list = list.filter(item => {
        if (!item.date) return false;
        const dDate = parseToDateObject(item.date);
        if (dDate.getTime() === 0) return false;

        const diffTime = Math.abs(now - dDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (dateFilter === 'today') {
          return dDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'yesterday') {
          const yesterday = new Date();
          yesterday.setDate(now.getDate() - 1);
          return dDate.toDateString() === yesterday.toDateString();
        } else if (dateFilter === 'week') {
          return diffDays <= 7;
        } else if (dateFilter === 'month') {
          return diffDays <= 30;
        }
        return true;
      });
    }

    // 3. Filter by text search
    if (q) {
      list = list.filter(item =>
        item.id.toLowerCase().includes(q) ||
        item.style.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }

    // 4. Sort by Age/Date
    list.sort((a, b) => {
      const dateA = parseToDateObject(a.date);
      const dateB = parseToDateObject(b.date);

      const valA = dateA.getTime();
      const valB = dateB.getTime();

      if (ageSort === 'newest') {
        return valB - valA;
      } else {
        return valA - valB;
      }
    });

    return list;
  }, [lotOptions, designs, pos, searchQuery, typeFilter, ageSort, dateFilter]);

  // Auto-select first lot so timeline is immediately active and not blank
  useEffect(() => {
    if (!selectedLotId && filteredLotsList.length > 0) {
      setSelectedLotId(filteredLotsList[0].id);
    }
  }, [filteredLotsList, selectedLotId]);

  const resolvedLotId = useMemo(() => {
    if (!selectedLotId) return '';
    const cleanId = String(selectedLotId).trim().toUpperCase();
    if (cleanId.startsWith('PO-')) {
      const po = pos.find(p => String(p.poNumber).toUpperCase().trim() === cleanId);
      if (po && po.designName) {
        return po.designName;
      }
    }
    return selectedLotId;
  }, [selectedLotId, pos]);

  const selectedDesign = designs.find(d => String(d.id).toLowerCase() === String(resolvedLotId).toLowerCase());

  // Compile timeline events dynamically for the selected lot ID
  const getTimelineEvents = () => {
    if (!selectedLotId) return [];

    const events = [];
    const lotIdLower = resolvedLotId.toLowerCase();

    // 1. Milestone: Design Registration
    if (selectedDesign) {
      const regTime = selectedDesign.created_at || selectedDesign.date;
      events.push({
        type: 'registration',
        title: 'Design Pack Registered',
        timestamp: formatDateTime(regTime) || 'Initial Stage',
        dateObj: parseToDateObject(regTime),
        actor: selectedDesign.designer || 'System',
        icon: <FileText size={16} />,
        color: '#3b82f6',
        details: (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginTop: '6px' }}>
            <div><strong>Style:</strong> {selectedDesign.style || 'N/A'}</div>
            <div><strong>Category:</strong> {selectedDesign.category || 'N/A'}</div>
            <div><strong>Brand/Client:</strong> {selectedDesign.brand || 'N/A'}</div>
            <div><strong>Fabric Type:</strong> {selectedDesign.fabricType || 'N/A'}</div>
            <div><strong>Target Pieces:</strong> {selectedDesign.quantity || 100} pcs</div>
            <div><strong>Status:</strong> {selectedDesign.status}</div>
          </div>
        )
      });
    }

    // 2. Milestone: Technical Verification Approvals/Rejections (from design_history table)
    const lotHistory = historyLogs.filter(h => String(h.lotId).toLowerCase() === lotIdLower);
    lotHistory.forEach(h => {
      const isApprove = h.action === 'approved';
      events.push({
        type: 'verification',
        title: isApprove ? 'Technical Verification Approved' : 'Technical Verification Update',
        timestamp: formatDateTime(h.timestamp),
        dateObj: parseToDateObject(h.timestamp),
        actor: h.actorName || 'Admin',
        icon: isApprove ? <ShieldCheck size={16} /> : <AlertCircle size={16} />,
        color: isApprove ? '#10b981' : '#ef4444',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Action:</strong> {h.action?.toUpperCase()}</p>
            {h.details && <p><strong>Comments:</strong> {h.details}</p>}
          </div>
        )
      });
    });

    // 3. Milestone: General Purchase Orders (PO) compiled
    const matchingPOs = pos.filter(po =>
      (po.designName && String(po.designName).toLowerCase() === lotIdLower) ||
      (po.poNumber && String(po.poNumber).toLowerCase() === lotIdLower)
    );
    matchingPOs.forEach(po => {
      let parsedItems = [];
      try {
        parsedItems = typeof po.items === 'string' ? JSON.parse(po.items) : po.items || [];
      } catch (e) { }

      events.push({
        type: 'po_general',
        title: `Trim Purchase Order Issued (${po.poNumber})`,
        timestamp: formatDateTime(po.date) || 'Processed',
        dateObj: parseToDateObject(po.date),
        actor: 'Purchasing',
        icon: <ClipboardList size={16} />,
        color: '#6366f1',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Supplier:</strong> {po.vendorName}</p>
            <p><strong>Total Amount:</strong> {currencySymbol}{po.total?.toFixed(2)}</p>
            <p><strong>PO Status:</strong> <span className={`status-badge ${po.status?.toLowerCase() === 'approved' ? 'verified' : 'pending'}`}>{po.status}</span></p>
            {parsedItems.length > 0 && (
              <table style={{ width: '100%', marginTop: '6px', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '4px' }}>Item</th>
                    <th style={{ padding: '4px', textAlign: 'right' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '4px' }}>{item.description}</td>
                      <td style={{ padding: '4px', textAlign: 'right' }}>{item.qty} {item.uom || 'pcs'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      });
    });

    // 4. Milestone: Zip PO compiled — from zip table directly
    const matchingZipOrder = zipOrders.find(z => String(z.Lot_Number).toLowerCase() === lotIdLower);
    if (matchingZipOrder) {
      const zipPoNum = matchingZipOrder.po_number || '';
      const zipTime = matchingZipOrder.Saved_At || matchingZipOrder.Issue_Date || selectedDesign?.date;
      let placements = [];
      try {
        placements = JSON.parse(matchingZipOrder.Selected_Placements || '[]');
      } catch (_) { }
      events.push({
        type: 'zip_po_created',
        title: `Zip Purcharge Orders Compiled${zipPoNum ? ` — ${zipPoNum}` : ''}`,
        timestamp: formatDateTime(zipTime) || 'Processed',
        dateObj: parseToDateObject(zipTime),
        actor: matchingZipOrder.Supervisor || 'Storekeeper',
        icon: <Scissors size={16} />,
        color: '#ec4899',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            {zipPoNum && <p><strong>PO Number:</strong> <span style={{ color: '#7c3aed', fontWeight: '700' }}>{zipPoNum}</span></p>}
            <p><strong>Garment:</strong> {matchingZipOrder.Garment_Type || matchingZipOrder.ch_garment || 'N/A'} — {matchingZipOrder.Style || matchingZipOrder.ch_style || ''}</p>
            <p><strong>Total Pieces:</strong> {parseInt(matchingZipOrder.Total_Pieces_CH || matchingZipOrder.Total_Pieces) || 0} pcs</p>
            <p><strong>Total Cost:</strong> ₹{parseFloat(matchingZipOrder.Total_Cost || 0).toLocaleString('en-IN')}</p>
            <p><strong>Supervisor:</strong> {matchingZipOrder.Supervisor || 'N/A'}</p>
            {placements.length > 0 && (
              <p><strong>Placements:</strong> {placements.join(', ')}</p>
            )}
            {matchingZipOrder.Gate_Entry_Person && <p><strong>Gate Entry:</strong> {matchingZipOrder.Gate_Entry_Person} on {matchingZipOrder.Gate_Entry_Date ? new Date(matchingZipOrder.Gate_Entry_Date).toLocaleDateString('en-GB') : ''}</p>}
            {matchingZipOrder.Material_Received_By && <p><strong>Material Received:</strong> {matchingZipOrder.Material_Received_By} on {matchingZipOrder.Material_Received_Date ? new Date(matchingZipOrder.Material_Received_Date).toLocaleDateString('en-GB') : ''}</p>}
            {matchingZipOrder.Supplier_Name && <p><strong>Supplier:</strong> {matchingZipOrder.Supplier_Name}</p>}
          </div>
        )
      });
    }

    // 5. Milestone: Doori PO compiled — from doori table directly
    const matchingDooriOrder = dooriOrders.find(h => String(h.Lot_Number).toLowerCase() === lotIdLower);
    if (matchingDooriOrder && matchingDooriOrder.dori_payload) {
      const doriPoNum = matchingDooriOrder.po_number || '';
      const doriTime = matchingDooriOrder.Issue_Date || matchingDooriOrder.Timestamp || selectedDesign?.date;
      let placements = [];
      try {
        placements = JSON.parse(matchingDooriOrder.Selected_Placements || '[]');
      } catch (_) { }
      events.push({
        type: 'doori_po_created',
        title: `Thread / Doori PO Compiled${doriPoNum ? ` — ${doriPoNum}` : ''}`,
        timestamp: formatDateTime(doriTime) || 'Processed',
        dateObj: parseToDateObject(doriTime),
        actor: matchingDooriOrder.Supervisor || 'Storekeeper',
        icon: <Shuffle size={16} />,
        color: '#f59e0b',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            {doriPoNum && <p><strong>PO Number:</strong> <span style={{ color: '#f59e0b', fontWeight: '700' }}>{doriPoNum}</span></p>}
            <p><strong>Garment:</strong> {matchingDooriOrder.Garment_Type || 'N/A'} — {matchingDooriOrder.Style || ''}</p>
            <p><strong>Total Pieces:</strong> {parseInt(matchingDooriOrder.Total_Pieces) || 0} pcs</p>
            <p><strong>Total Cost:</strong> ₹{parseFloat(matchingDooriOrder.Total_Cost || 0).toLocaleString('en-IN')}</p>
            <p><strong>Supervisor:</strong> {matchingDooriOrder.Supervisor || 'N/A'}</p>
            {placements.length > 0 && (
              <p><strong>Placements:</strong> {placements.join(', ')}</p>
            )}
            {matchingDooriOrder.Gate_Entry_Person && <p><strong>Gate Entry:</strong> {matchingDooriOrder.Gate_Entry_Person} on {matchingDooriOrder.Gate_Entry_Date ? new Date(matchingDooriOrder.Gate_Entry_Date).toLocaleDateString('en-GB') : ''}</p>}
            {matchingDooriOrder.Material_Received_By && <p><strong>Material Received:</strong> {matchingDooriOrder.Material_Received_By} on {matchingDooriOrder.Material_Received_Date ? new Date(matchingDooriOrder.Material_Received_Date).toLocaleDateString('en-GB') : ''}</p>}
            {matchingDooriOrder.Supplier_Name && <p><strong>Supplier:</strong> {matchingDooriOrder.Supplier_Name}</p>}
          </div>
        )
      });
    }

    // 6. Milestones: Scanner activity and Returnable Gate Passes (RGPs) (from scans table)
    // First, find all RGP document numbers that are associated with the selected design lot
    const associatedRgpNumbers = new Set();
    scanLogs.forEach(s => {
      if (s.rgp_payload) {
        try {
          const rgpData = JSON.parse(s.rgp_payload);
          const hasLot = rgpData && Array.isArray(rgpData.entries) &&
            rgpData.entries.some(entry => String(entry.lotNo).toLowerCase() === lotIdLower);
          if (hasLot) {
            associatedRgpNumbers.add(String(s.lot_number).toLowerCase());
            if (rgpData.rgpNo) {
              associatedRgpNumbers.add(String(rgpData.rgpNo).toLowerCase());
            }
          }
        } catch (e) { }
      }
    });

    const matchingScans = scanLogs.filter(s => {
      const scanLotLower = String(s.lot_number).toLowerCase();
      // Direct Design Lot match
      if (scanLotLower === lotIdLower) return true;
      // RGP Number match
      if (associatedRgpNumbers.has(scanLotLower)) return true;
      return false;
    });

    matchingScans.forEach(s => {
      const isRGP = s.scan_type === 'rgp_entry' || s.scan_type === 'rgp_return' || s.rgp_payload;

      if (isRGP) {
        let rgpData = null;
        try {
          rgpData = s.rgp_payload ? JSON.parse(s.rgp_payload) : null;
        } catch (e) { }

        events.push({
          type: 'rgp_log',
          title: (s.scan_type === 'rgp_return' ? 'Fabric RGP Returned' : 'Fabric RGP Dispatched') + ` (#${s.lot_number})`,
          timestamp: formatDateTime(s.scanned_at) || 'Logged',
          dateObj: parseToDateObject(s.scanned_at),
          actor: s.person_name || 'Gatekeeper',
          icon: <Truck size={16} />,
          color: '#a855f7',
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <p><strong>Processor:</strong> {s.supplier_name}</p>
              <p><strong>Dispatched Item:</strong> {s.material_name}</p>
              {rgpData && (
                <>
                  {rgpData.rollsInfo && <p><strong>Rolls/Bales:</strong> {rgpData.rollsInfo}</p>}

                  {/* Detailed itemized list from the RGP entries */}
                  {rgpData.entries && rgpData.entries.length > 0 && (
                    <div style={{ marginTop: '10px', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                      <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--accent-color)' }}>RGP Dispatch List:</strong>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '4px' }}>Item Details</th>
                            <th style={{ padding: '4px', textAlign: 'right' }}>Qty 1</th>
                            <th style={{ padding: '4px', textAlign: 'right' }}>Qty 2</th>
                            <th style={{ padding: '4px' }}>Purpose</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rgpData.entries.map((entry, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '4px' }}>{entry.itemDesc || 'N/A'}</td>
                              <td style={{ padding: '4px', textAlign: 'right' }}>{entry.qty1 || 0} {entry.uom || 'pcs'}</td>
                              <td style={{ padding: '4px', textAlign: 'right' }}>{entry.qty2 || 0} {entry.uom || 'pcs'}</td>
                              <td style={{ padding: '4px' }}>{entry.purpose || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        });
      } else {
        // Barcode scans (Gate Entry, Material Received, or Printing Gate Out)
        const isGate = s.scan_type === 'gate_entry';
        const isPrintingOut = s.scan_type === 'printing_gate_out';
        
        let title = 'Arrival Scanned at Gate';
        let color = '#14b8a6';
        if (isPrintingOut) {
          title = 'Printing Gate Out Scan';
          color = '#f97316';
        } else if (!isGate) {
          title = 'Material Received & Checked-In';
          color = '#06b6d4';
        }

        events.push({
          type: 'barcode_scan',
          title: title,
          timestamp: formatDateTime(s.scanned_at) || 'Scanned',
          dateObj: parseToDateObject(s.scanned_at),
          actor: s.person_name,
          icon: <QrCode size={16} />,
          color: color,
          details: (
            <div style={{ fontSize: '12px', marginTop: '6px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
              {isGate ? (
                <p><strong>Gatekeeper Log:</strong> Verified delivery bundle from <strong>{s.supplier_name}</strong> carrying item: <em>{s.material_name}</em>.</p>
              ) : isPrintingOut ? (
                <p><strong>Printing Log:</strong> Sent out <strong>{s.quantity} pcs</strong> of <strong>{s.material_name}</strong> for printing by <strong>{s.person_name}</strong>.</p>
              ) : (
                <p><strong>Store Log:</strong> Checked-in <strong>{s.quantity} pcs</strong> of <strong>{s.material_name}</strong> into catalog stock from supplier <strong>{s.supplier_name}</strong>.</p>
              )}
            </div>
          )
        });
      }
    });

    // 7. Milestone: Material Issues and Returns (from issue_logs table)
    const lotIssueLogs = issueLogs.filter(log => String(log.lotId).toLowerCase() === lotIdLower);
    lotIssueLogs.forEach(log => {
      const isRet = log.isReturn === 1 || log.isReturn === true;
      const isRe = log.isReissue === 1 || log.isReissue === true;

      let parsedMaterials = [];
      try {
        parsedMaterials = typeof log.materials === 'string' ? JSON.parse(log.materials) : log.materials || [];
      } catch (e) { }

      let title = "Materials Issued";
      if (isRet) title = "Materials Returned";
      else if (isRe) title = "Materials Re-Issued";

      events.push({
        type: 'material_issue_log',
        title: title,
        timestamp: formatDateTime(log.date) || 'Processed',
        dateObj: parseToDateObject(log.date),
        actor: log.receiverName ? `${log.personName || 'Store'} → ${log.receiverName}` : (log.personName || 'Storekeeper'),
        icon: <ClipboardList size={16} />,
        color: isRet ? '#ef4444' : (isRe ? '#84cc16' : '#10b981'),
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Category:</strong> {log.category || 'N/A'}</p>
            <p><strong>Issuer Person:</strong> {log.personName || 'Storekeeper'}</p>
            {log.receiverName && (
              <p><strong>Received By:</strong> <span style={{ fontWeight: '700', color: 'var(--accent-color)' }}>{log.receiverName}</span> {log.receiverDept ? `(${log.receiverDept})` : ''}</p>
            )}
            <p><strong>Total Items Count:</strong> {log.volume || 0} pcs</p>
            {parsedMaterials.length > 0 && (
              <table style={{ width: '100%', marginTop: '6px', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '4px' }}>Material Item</th>
                    <th style={{ padding: '4px', textAlign: 'right' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedMaterials.map((mat, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '4px' }}>{mat.name || mat.materialName || mat.description}</td>
                      <td style={{ padding: '4px', textAlign: 'right' }}>{mat.qty || mat.quantity || mat.issueQty || 0} {mat.unit || 'pcs'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      });
    });

    // 8. Milestone: Dedicated Extra Material Issues (from extra_material_issues table)
    const lotExtraIssues = extraMaterialIssues.filter(ei => String(ei.lotId).toLowerCase() === lotIdLower);
    lotExtraIssues.forEach(ei => {
      const alreadyInIssueLogs = lotIssueLogs.some(l => String(l.id).includes(String(ei.voucherId)));
      if (alreadyInIssueLogs) return;

      const items = Array.isArray(ei.items) ? ei.items : [];
      events.push({
        type: 'extra_material_issue',
        title: `Extra Material Requisition (${ei.voucherId || 'Voucher'})`,
        timestamp: formatDateTime(ei.issueDate || ei.createdAt) || 'Processed',
        dateObj: parseToDateObject(ei.issueDate || ei.createdAt),
        actor: ei.personName || 'Store Staff',
        icon: <AlertCircle size={16} />,
        color: '#dc2626',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Voucher No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{ei.voucherId}</span></p>
            <p><strong>Receiver:</strong> {ei.receiverName || 'Tailor'} ({ei.receiverDept || 'Cutting'})</p>
            <p><strong>Status:</strong> <span className="status-badge verified">{ei.status || 'Issued'}</span></p>
            {items.length > 0 && (
              <table style={{ width: '100%', marginTop: '6px', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '4px' }}>Component / Material</th>
                    <th style={{ padding: '4px', textAlign: 'right' }}>Extra Qty</th>
                    <th style={{ padding: '4px' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '4px' }}>{it.bomItemName || it.materialName}</td>
                      <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>+{it.totalRequired} {it.unit}</td>
                      <td style={{ padding: '4px', fontSize: '10.5px' }}>{it.reason || 'Extra requisition'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      });
    });

    // 9. Milestone: Weight Captures (from weight_capture table)
    const lotWeights = weightCaptures.filter(wc => String(wc.lotNo).toLowerCase() === lotIdLower);
    lotWeights.forEach(wc => {
      events.push({
        type: 'weight_capture_log',
        title: `Material Weight Captured (${wc.materialName || 'Fabric/Trims'})`,
        timestamp: formatDateTime(wc.capturedAt || wc.createdAt) || 'Processed',
        dateObj: parseToDateObject(wc.capturedAt || wc.createdAt),
        actor: wc.storeIncharge || 'Weighbridge Staff',
        icon: <ShieldCheck size={16} />,
        color: '#8b5cf6',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Material:</strong> {wc.materialName} ({wc.materialCode || '—'})</p>
            <p><strong>Pieces:</strong> {wc.pieces || 0} pcs</p>
            <p><strong>Net Weight:</strong> {wc.netWeightKg || wc.weight || 0} kg</p>
            <p><strong>Operator:</strong> {wc.storeIncharge || 'Store'}</p>
          </div>
        )
      });
    });

    // 10. Milestone: Material Transfers
    const lotTransfers = transfers.filter(t => 
      (t.lotId && String(t.lotId).toLowerCase() === lotIdLower) ||
      (t.lotNumber && String(t.lotNumber).toLowerCase() === lotIdLower)
    );
    lotTransfers.forEach(t => {
      events.push({
        type: 'stock_transfer_log',
        title: `Stock Transferred to ${t.toLocation}`,
        timestamp: formatDateTime(t.transferredAt || t.date) || 'Transferred',
        dateObj: parseToDateObject(t.transferredAt || t.date),
        actor: t.operator || t.transferredBy || 'Admin',
        icon: <Shuffle size={16} />,
        color: '#f59e0b',
        details: (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <p><strong>Material:</strong> {t.materialName || t.materialCode}</p>
            <p><strong>From:</strong> {t.fromLocation || 'Store'} → <strong>To:</strong> {t.toLocation}</p>
            <p><strong>Quantity:</strong> {t.quantity || t.qty} packets/units</p>
          </div>
        )
      });
    });

    // Sort events chronologically
    return events.sort((a, b) => a.dateObj - b.dateObj);
  };

  const getWorkflowSteps = () => {
    if (!selectedLotId) return [];

    const lotIdLower = resolvedLotId.toLowerCase().trim();

    // 1. Design Stage
    const designExists = !!selectedDesign;
    const designDate = selectedDesign ? (selectedDesign.created_at || selectedDesign.date) : '';
    const designer = selectedDesign ? (selectedDesign.designer || 'System') : '';

    // 2. Approved Stage
    const approvedLog = historyLogs.find(h => String(h.lotId).toLowerCase() === lotIdLower && h.action === 'approved');
    const designApproved = (selectedDesign?.status?.toLowerCase() === 'approved') || !!approvedLog;
    const approvalDate = approvedLog ? approvedLog.timestamp : (designApproved ? designDate : '');
    const approvalActor = approvedLog ? approvedLog.actorName : (designApproved ? 'Admin' : '');

    // 3. Trim PO Stage
    const matchingPOs = pos.filter(po =>
      (po.designName && String(po.designName).toLowerCase() === lotIdLower) ||
      (po.poNumber && String(po.poNumber).toLowerCase() === lotIdLower)
    );
    const poReleased = matchingPOs.length > 0;
    const poDate = poReleased ? matchingPOs[0].date : '';

    // 4. RGP Stage — gather all associated scans grouped by RGP number
    const associatedRgpNumbers = new Set();
    scanLogs.forEach(s => {
      if (s.rgp_payload) {
        try {
          const rgpData = JSON.parse(s.rgp_payload);
          const hasLot = rgpData && Array.isArray(rgpData.entries) &&
            rgpData.entries.some(entry => String(entry.lotNo).toLowerCase() === lotIdLower);
          if (hasLot) {
            associatedRgpNumbers.add(String(s.lot_number).toLowerCase());
            if (rgpData.rgpNo) associatedRgpNumbers.add(String(rgpData.rgpNo).toLowerCase());
          }
        } catch (e) { }
      }
    });

    const rgpScans = scanLogs.filter(s => {
      const scanLotLower = String(s.lot_number).toLowerCase();
      if (scanLotLower === lotIdLower) return s.scan_type === 'rgp_entry' || s.scan_type === 'rgp_return' || s.rgp_payload;
      if (associatedRgpNumbers.has(scanLotLower)) return true;
      return false;
    });
    const rgpReleased = rgpScans.length > 0;
    const rgpDate = rgpReleased ? rgpScans[0].scanned_at : '';
    const rgpActor = rgpReleased ? rgpScans[0].person_name : '';

    // Helper: build scanner sub-steps for a given lot reference
    const buildScannerSubSteps = (lotRef) => {
      const ref = String(lotRef).toLowerCase();
      const gate = scanLogs.find(s => String(s.lot_number).toLowerCase() === ref && s.scan_type === 'gate_entry');
      const matIn = scanLogs.find(s => String(s.lot_number).toLowerCase() === ref && s.scan_type === 'material_in');
      const sup = scanLogs.find(s => String(s.lot_number).toLowerCase() === ref && s.scan_type === 'supplier_entry');
      return [
        { id: 'gate_entry', label: 'Gate Entry', icon: '🔒', done: !!gate, data: gate },
        { id: 'material_in', label: 'Material Received', icon: '📦', done: !!matIn, data: matIn },
        { id: 'supplier_entry', label: 'Supplier Check-In', icon: '🏭', done: !!sup, data: sup },
      ];
    };

    // RGP scanner sub-steps (use the lot ID for direct scans)
    const rgpSubSteps = buildScannerSubSteps(lotIdLower);

    // 5. ZIP Stage — from zip table
    const matchingZipOrder = zipOrders.find(z => String(z.Lot_Number).toLowerCase() === lotIdLower);
    const zipCompiled = !!matchingZipOrder;
    const zipDate = zipCompiled ? (matchingZipOrder.Saved_At || matchingZipOrder.Issue_Date || '') : '';
    const zipActor = zipCompiled ? (matchingZipOrder.Supervisor || 'Storekeeper') : '';
    const zipPoNum = zipCompiled ? (matchingZipOrder.po_number || '') : '';

    // Zip PO scanner sub-steps
    const zipSubSteps = buildScannerSubSteps(lotIdLower);

    // 6. Doori PO Stage
    const matchingDooriOrder = dooriOrders.find(h => String(h.Lot_Number).toLowerCase() === lotIdLower);
    const dooriPayloadExists = matchingDooriOrder && matchingDooriOrder.dori_payload;
    const dooriReleased = !!dooriPayloadExists;
    const dooriDate = dooriReleased ? (matchingDooriOrder.Issue_Date || matchingDooriOrder.Timestamp || '') : '';
    const dooriActor = dooriReleased ? (matchingDooriOrder.Supervisor || 'Storekeeper') : '';
    const doriPoNum = dooriReleased ? (matchingDooriOrder.po_number || '') : '';

    // Doori PO scanner sub-steps
    const dooriSubSteps = buildScannerSubSteps(lotIdLower);

    return [
      {
        id: 'design',
        name: 'Design Registration',
        isComplete: designExists,
        date: designDate,
        actor: designer,
        icon: <FileText size={16} />,
        details: selectedDesign ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginTop: '6px' }}>
            <div><strong>Style:</strong> {selectedDesign.style || 'N/A'}</div>
            <div><strong>Category:</strong> {selectedDesign.category || 'N/A'}</div>
            <div><strong>Brand/Client:</strong> {selectedDesign.brand || 'N/A'}</div>
            <div><strong>Fabric Type:</strong> {selectedDesign.fabricType || 'N/A'}</div>
            <div><strong>Target Pieces:</strong> {selectedDesign.quantity || 100} pcs</div>
          </div>
        ) : null
      },
      {
        id: 'approved',
        name: 'Technical Verification Approval',
        isComplete: designApproved,
        date: approvalDate,
        actor: approvalActor,
        icon: <ShieldCheck size={16} />,
        details: designApproved ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <div><strong>Status:</strong> Approved</div>
            {approvedLog?.details && <div style={{ marginTop: '4px' }}><strong>Comments:</strong> {approvedLog.details}</div>}
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Awaiting technical verification approval.</span>
      },
      {
        id: 'po',
        name: 'Trim Purchase Order (PO) Release',
        isComplete: poReleased,
        date: poDate,
        actor: poReleased ? 'Purchasing' : '',
        icon: <ClipboardList size={16} />,
        details: poReleased ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <strong>Associated Trim POs ({matchingPOs.length}):</strong>
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              {matchingPOs.map((po, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>
                  PO #{po.poNumber} to <strong>{po.vendorName}</strong> — {currencySymbol}{po.total?.toFixed(2)} ({po.status})
                </li>
              ))}
            </ul>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No Trim Purchase Orders released yet.</span>
      },
      {
        id: 'rgp',
        name: 'Fabric RGP (Returnable Gate Pass)',
        isComplete: rgpReleased,
        date: rgpDate,
        actor: rgpActor,
        icon: <Truck size={16} />,
        subSteps: rgpReleased ? rgpSubSteps : [],
        details: rgpReleased ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {rgpScans.map((s, idx) => (
                <span key={idx} style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7', padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}>
                  RGP #{s.lot_number}
                </span>
              ))}
            </div>
            <div><strong>Supplier:</strong> {rgpScans[0]?.supplier_name || 'N/A'}</div>
            <div><strong>Material:</strong> {rgpScans[0]?.material_name || 'N/A'}</div>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Returnable Gate Pass dispatch has not been logged.</span>
      },
      {
        id: 'zip',
        name: `Zip Purcharge Orders — Zipper Selection${zipPoNum ? ` (${zipPoNum})` : ''}`,
        isComplete: zipCompiled,
        date: zipDate,
        actor: zipActor,
        icon: <Scissors size={16} />,
        subSteps: zipCompiled ? zipSubSteps : [],
        details: zipCompiled ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            {zipPoNum && <div><strong>PO Number:</strong> <span style={{ color: '#7c3aed', fontWeight: '700' }}>{zipPoNum}</span></div>}
            <div><strong>Garment:</strong> {matchingZipOrder.Garment_Type || matchingZipOrder.ch_garment || 'N/A'} — {matchingZipOrder.Style || matchingZipOrder.ch_style || ''}</div>
            <div><strong>Total Pieces:</strong> {parseInt(matchingZipOrder.Total_Pieces_CH || matchingZipOrder.Total_Pieces) || 0} pcs</div>
            <div><strong>Total Cost:</strong> ₹{parseFloat(matchingZipOrder.Total_Cost || 0).toLocaleString('en-IN')}</div>
            <div><strong>Supervisor:</strong> {matchingZipOrder.Supervisor || 'N/A'}</div>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Zipper specifications not yet compiled.</span>
      },
      {
        id: 'doori',
        name: `Dori Purcharge Orders — Thread / Drawstring${doriPoNum ? ` (${doriPoNum})` : ''}`,
        isComplete: dooriReleased,
        date: dooriDate,
        actor: dooriActor,
        icon: <Shuffle size={16} />,
        subSteps: dooriReleased ? dooriSubSteps : [],
        details: dooriReleased ? (
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            {doriPoNum && <div><strong>PO Number:</strong> <span style={{ color: '#f59e0b', fontWeight: '700' }}>{doriPoNum}</span></div>}
            <div><strong>Garment:</strong> {matchingDooriOrder.Garment_Type || 'N/A'} — {matchingDooriOrder.Style || ''}</div>
            <div><strong>Total Pieces:</strong> {parseInt(matchingDooriOrder.Total_Pieces) || 0} pcs</div>
            <div><strong>Total Cost:</strong> ₹{parseFloat(matchingDooriOrder.Total_Cost || 0).toLocaleString('en-IN')}</div>
            <div><strong>Supervisor:</strong> {matchingDooriOrder.Supervisor || 'N/A'}</div>
          </div>
        ) : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Thread / doori purchase specifications not yet compiled.</span>
      },
    ];
  };

  const downloadWorkflowPDF = () => {
    if (!selectedDesign) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const lotId = selectedDesign.id;
    const lotIdLower = lotId.toLowerCase().trim();
    const matchingZipHeader = cuttingHeaders.find(h => String(h.Lot_Number).toLowerCase() === lotIdLower);
    const matchingDooriOrder = dooriOrders.find(h => String(h.Lot_Number).toLowerCase() === lotIdLower);

    const allSteps = getWorkflowSteps();
    const steps = allSteps.filter(step => {
      if (step.id === 'design' || step.id === 'approved') return true;
      return step.isComplete;
    });
    const gateScanDone = allSteps.find(s => s.id === 'gate_scan')?.isComplete;
    const materialScanDone = allSteps.find(s => s.id === 'material_scan')?.isComplete;
    const supplierScanDone = allSteps.find(s => s.id === 'supplier_scan')?.isComplete;
    const designApproved = allSteps.find(s => s.id === 'approved')?.isComplete;
    const allComplete = designApproved && (gateScanDone || materialScanDone || supplierScanDone);

    // Title / Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(31, 41, 55); // slate-800
    doc.text('Lot Operational Workflow Report', 40, 50);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, 40, 68);

    // Status Banner in PDF
    const statusText = allComplete ? 'WORKFLOW STATUS: COMPLETE' : 'WORKFLOW STATUS: IN PROGRESS';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (allComplete) {
      doc.setTextColor(16, 185, 129); // green-500
    } else {
      doc.setTextColor(245, 158, 11); // amber-500
    }
    doc.text(statusText, 380, 50);
    doc.setTextColor(31, 41, 55); // Reset

    // Lot Info Box
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setFillColor(249, 250, 251); // gray-50
    doc.rect(40, 85, 515, 90, 'FD');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Lot Information', 50, 105);

    doc.setFont('helvetica', 'normal');
    doc.text(`Lot Number: #${lotId}`, 50, 125);
    doc.text(`Style Code: ${selectedDesign.style || 'N/A'}`, 50, 140);
    doc.text(`Brand / Client: ${selectedDesign.brand || 'N/A'}`, 50, 155);

    doc.text(`Category: ${selectedDesign.category || 'N/A'}`, 260, 125);
    doc.text(`Fabric Spec: ${selectedDesign.fabricType || 'N/A'}`, 260, 140);
    doc.text(`Target Pieces: ${selectedDesign.quantity || 100} pcs`, 260, 155);

    // Section 1: Workflow Checklist
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text('1. Workflow Stage Progress Checklist', 40, 205);

    const checklistHeaders = [['Step', 'Workflow Stage', 'Status', 'Completed Date/Time', 'Actor / Operator']];
    const checklistBody = steps.map((step, idx) => {
      let stepStatusText = step.isComplete ? 'COMPLETED' : 'PENDING';
      let formattedDate = step.isComplete ? formatDateTime(step.date) : '—';
      let actorName = step.isComplete ? step.actor : '—';

      return [
        idx + 1,
        step.name,
        stepStatusText,
        formattedDate,
        actorName
      ];
    });

    autoTable(doc, {
      head: checklistHeaders,
      body: checklistBody,
      startY: 215,
      margin: { left: 40, right: 40 },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 6 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] }, // indigo-600
      didParseCell: function (data) {
        if (data.column.index === 2) {
          if (data.cell.text[0] === 'COMPLETED') {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [156, 163, 175];
          }
        }
      }
    });

    // Section 2: Chronological History Audit Log
    const nextY = doc.lastAutoTable.finalY + 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text('2. Detailed Operational History Log', 40, nextY);

    const logHeaders = [['Timestamp', 'Event Title', 'Actor / Operator', 'Operational Details']];
    const logBody = timelineEvents.map(evt => {
      let detailsText = '';
      if (evt.type === 'registration') {
        detailsText = `Style: ${selectedDesign.style || 'N/A'}, Category: ${selectedDesign.category || 'N/A'}, Brand: ${selectedDesign.brand || 'N/A'}, Target: ${selectedDesign.quantity || 100} pcs`;
      } else if (evt.type === 'verification') {
        const matchingLog = historyLogs.find(h => formatDateTime(h.timestamp) === evt.timestamp);
        detailsText = matchingLog?.details || 'Technical Verification approved.';
      } else if (evt.type === 'po_general') {
        const poNum = evt.title.match(/\(([^)]+)\)/)?.[1] || '';
        const matchingPo = pos.find(p => p.poNumber === poNum);
        detailsText = `Supplier: ${matchingPo?.vendorName || 'N/A'}, Total Amount: ${currencySymbol}${matchingPo?.total || 0}`;
      } else if (evt.type === 'zip_po_created') {
        detailsText = `Compiled zipper specification selection. Priority: ${matchingZipHeader?.Priority || 'Normal'}`;
      } else if (evt.type === 'doori_po_created') {
        detailsText = `Compiled doori/thread specifications. Priority: ${matchingDooriOrder?.priority || 'Normal'}`;
      } else if (evt.type === 'rgp_log') {
        detailsText = `Dispatched/Returned fabric gate pass. Processor: ${evt.actor}`;
      } else if (evt.type === 'barcode_scan') {
        const isGate = evt.title.includes('Arrival');
        detailsText = isGate ? 'Scanned entry gate pass check.' : 'Materials received and catalog stock checked-in.';
      } else if (evt.type === 'material_issue_log') {
        const matchingLog = issueLogs.find(l => formatDateTime(l.date) === evt.timestamp);
        detailsText = `Category: ${matchingLog?.category || 'N/A'}, Vol: ${matchingLog?.volume || 0}`;
      } else {
        detailsText = 'Status update compiled in system logs.';
      }

      return [
        evt.timestamp,
        evt.title,
        evt.actor || 'System',
        detailsText
      ];
    });

    autoTable(doc, {
      head: logHeaders,
      body: logBody,
      startY: nextY + 15,
      margin: { left: 40, right: 40 },
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255] } // gray-700
    });

    doc.save(`Lot_${lotId}_Workflow_Report.pdf`);
  };

  const timelineEvents = getTimelineEvents();
  const workflowSteps = getWorkflowSteps();
  const completedStepsCount = workflowSteps.filter(s => s.isComplete).length;
  const visibleSteps = workflowSteps.filter(step => {
    if (step.id === 'design' || step.id === 'approved') return true;
    return step.isComplete;
  });
  const designApproved = workflowSteps.find(s => s.id === 'approved')?.isComplete;
  const rgpDone = workflowSteps.find(s => s.id === 'rgp')?.isComplete;
  const zipDone = workflowSteps.find(s => s.id === 'zip')?.isComplete;
  const dooriDone = workflowSteps.find(s => s.id === 'doori')?.isComplete;
  const allComplete = designApproved && (rgpDone || zipDone || dooriDone);

  // Helper function to resolve dynamic design image preview URLs
  const getCleanImageUrl = (url) => {
    if (!url) return '';
    return url.replace('wait', `${getBackendUrl()}`);
  };

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '22px', fontWeight: '700' }}>Production Work History</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Compile the complete operational history of a design lot (registration, approvals, PO creations, returnable gate pass, gate check-ins, and store receipts).</p>
      </div>

      {errorMessage && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: '13px' }}>{errorMessage}</span>
        </div>
      )}

      {/* === Visual Stage Overview Analytics Banner === */}
      {filteredLotsList.length > 0 && (
        <div className="animate-slide-up" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          marginBottom: '24px'
        }}>
          {/* Total Lots */}
          {[
            {
              label: 'Total Lots',
              value: filteredLotsList.length,
              icon: <ClipboardList size={18} />,
              color: '#0284c7',
              bg: '#e0f2fe',
              pct: 100
            },
            {
              label: 'With Issues',
              value: issueLogs.filter(l => filteredLotsList.some(d => String(d.id) === String(l.lotId))).length,
              icon: <Activity size={18} />,
              color: '#059669',
              bg: '#d1fae5',
              pct: filteredLotsList.length > 0 ? Math.round((new Set(issueLogs.map(l => String(l.lotId))).size / filteredLotsList.length) * 100) : 0
            },
            {
              label: 'Transfers',
              value: transfers.length,
              icon: <Shuffle size={18} />,
              color: '#2563eb',
              bg: '#eff6ff',
              pct: filteredLotsList.length > 0 ? Math.min(Math.round((transfers.length / filteredLotsList.length) * 100), 100) : 0
            },
            {
              label: 'Scan Events',
              value: scanLogs.length,
              icon: <QrCode size={18} />,
              color: '#06b6d4',
              bg: '#cffafe',
              pct: filteredLotsList.length > 0 ? Math.min(Math.round((scanLogs.length / Math.max(filteredLotsList.length, 1)) * 100), 100) : 0
            },
            {
              label: 'Extra Issues',
              value: extraMaterialIssues.length,
              icon: <TrendingUp size={18} />,
              color: '#d97706',
              bg: '#fef3c7',
              pct: filteredLotsList.length > 0 ? Math.min(Math.round((extraMaterialIssues.length / Math.max(filteredLotsList.length, 1)) * 100), 100) : 0
            },
            {
              label: 'Weight Captures',
              value: weightCaptures.length,
              icon: <BarChart3 size={18} />,
              color: '#7c3aed',
              bg: '#ede9fe',
              pct: filteredLotsList.length > 0 ? Math.min(Math.round((weightCaptures.length / Math.max(filteredLotsList.length, 1)) * 100), 100) : 0
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="analytics-kpi-card"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '9px',
                  background: stat.bg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: stat.color
                }}>
                  {stat.icon}
                </div>
                <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', fontFamily: 'var(--font-family-title)' }}>
                  {stat.value}
                </span>
              </div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {stat.label}
              </div>
              <div style={{ height: '4px', borderRadius: '2px', background: '#f0f7ff', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(stat.pct, 100)}%`,
                  borderRadius: '2px',
                  background: `linear-gradient(90deg, ${stat.color}, ${stat.bg})`,
                  animation: 'barGrowRight 0.7s cubic-bezier(0.4, 0, 0.2, 1) both',
                  animationDelay: `${i * 0.08}s`
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Left Panel: Search & Lot select */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel" style={{ padding: '20px' }}>
            <h3 className="panel-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={16} />
              <span>Select Design Lot</span>
            </h3>

            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <input
                type="text"
                placeholder="Search Lot, Style, Brand..."
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '36px' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            {/* Quick Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Design Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: '6px',
                    border: '1.5px solid var(--border-color)', background: 'var(--bg-primary)',
                    fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', outline: 'none'
                  }}
                >
                  <option value="all">All Designs</option>
                  <option value="original">Original</option>
                  <option value="version">Recreated</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Sort Order</label>
                <select
                  value={ageSort}
                  onChange={(e) => setAgeSort(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: '6px',
                    border: '1.5px solid var(--border-color)', background: 'var(--bg-primary)',
                    fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', outline: 'none'
                  }}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Date Range</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: '6px',
                  border: '1.5px solid var(--border-color)', background: 'var(--bg-primary)',
                  fontSize: '11px', fontWeight: '700', color: 'var(--text-main)', outline: 'none'
                }}
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: '6px',
              maxHeight: '340px', overflowY: 'auto', paddingRight: '4px',
              border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px'
            }}>
              {filteredLotsList.map(d => (
                <div
                  key={d.id}
                  onClick={() => setSelectedLotId(d.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.15s',
                    backgroundColor: selectedLotId === d.id ? 'var(--accent-light, rgba(99, 102, 241, 0.08))' : 'transparent',
                    border: '1px solid',
                    borderColor: selectedLotId === d.id ? 'var(--accent-color)' : 'transparent',
                    color: selectedLotId === d.id ? 'var(--accent-color)' : 'var(--text-main)'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedLotId !== d.id) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    if (selectedLotId !== d.id) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: '700' }}>
                      {String(d.id).toUpperCase().startsWith('PO-') ? '' : 'Lot #'}
                      {getLotVersionInfo(d.id, designs).displayLot}
                    </span>
                    {getLotVersionInfo(d.id, designs).isRecreated && (
                      <span className="status-badge in-verification" style={{ fontSize: '9px', padding: '1px 4px', textTransform: 'none' }}>
                        {getLotVersionInfo(d.id, designs).versionText}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    <span>{d.brand} ({d.category})</span>
                    <span>{d.style}</span>
                  </div>
                  {d.date && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.75 }}>
                      <Clock size={9} />
                      <span>{formatDateTime(d.date)}</span>
                    </div>
                  )}
                </div>
              ))}
              {filteredLotsList.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No design lots found
                </div>
              )}
            </div>
          </div>

          {/* Lot Summary Details Card */}
          {selectedDesign && (
            <div className="panel animate-scale" style={{ padding: '20px' }}>
              <h3 className="panel-title" style={{ marginBottom: '14px' }}>Lot Specifications</h3>

              {selectedDesign.imageUrl && (
                <div style={{ width: '100%', height: '140px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px', marginBottom: '14px' }}>
                  <img
                    src={getCleanImageUrl(selectedDesign.imageUrl)}
                    alt="Design spec"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lot ID</span>
                  <span style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    #{getLotVersionInfo(selectedDesign.id, designs).displayLot}
                    {getLotVersionInfo(selectedDesign.id, designs).isRecreated && (
                      <span className="status-badge in-verification" style={{ fontSize: '10px', padding: '2px 6px', textTransform: 'none' }}>
                        {getLotVersionInfo(selectedDesign.id, designs).versionText}
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Style Code</span>
                  <span style={{ fontWeight: '600' }}>{selectedDesign.style}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Brand/Client</span>
                  <span style={{ fontWeight: '600' }}>{selectedDesign.brand}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Category</span>
                  <span style={{ fontWeight: '600' }}>{selectedDesign.category}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fabric Specification</span>
                  <span style={{ fontWeight: '600' }}>{selectedDesign.fabricType || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Target Pieces</span>
                  <span style={{ fontWeight: '700', color: 'var(--accent-color)' }}>{selectedDesign.quantity || 100} pcs</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Workflow Timeline */}
        <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel" style={{ padding: '24px', minHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} />
                <span>Timeline Workflow {selectedLotId ? `for Lot #${selectedLotId}` : ''}</span>
              </h3>
            </div>

            {selectedLotId && (
              <div style={{
                marginBottom: '20px',
                padding: '16px 20px',
                borderRadius: '12px',
                background: allComplete
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))'
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))',
                border: '1.5px solid',
                borderColor: allComplete ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: allComplete ? 'var(--success)' : 'var(--warning)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {allComplete ? <Check size={20} /> : <Clock size={20} />}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-main)' }}>
                      Production Work Status: {allComplete ? 'Complete' : 'In Progress'}
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {allComplete
                        ? 'All stages in the lot operational process have been successfully executed.'
                        : `${completedStepsCount} of ${workflowSteps.length} process stages completed. Awaiting remaining workflow steps.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedLotId && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '24px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '4px',
                  backgroundColor: 'var(--bg-primary)',
                  padding: '4px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)'
                }}>
                  <button
                    onClick={() => setViewMode('pipeline')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: viewMode === 'pipeline' ? 'var(--accent-color)' : 'transparent',
                      color: viewMode === 'pipeline' ? '#ffffff' : 'var(--text-muted)'
                    }}
                  >
                    Workflow Pipeline
                  </button>
                  <button
                    onClick={() => setViewMode('chronological')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: viewMode === 'chronological' ? 'var(--accent-color)' : 'transparent',
                      color: viewMode === 'chronological' ? '#ffffff' : 'var(--text-muted)'
                    }}
                  >
                    Chronological Log
                  </button>
                </div>

                <button
                  onClick={downloadWorkflowPDF}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: allComplete ? 'var(--success)' : 'var(--accent-color)',
                    color: '#ffffff',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <Download size={14} />
                  <span>Download PDF Report</span>
                </button>
              </div>
            )}

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--accent-light)', borderTopColor: 'var(--accent-color)', animation: 'spin 1s linear infinite' }}></div>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Compiling Workflow History Logs...</span>
              </div>
            ) : !selectedLotId ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={40} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>No Lot Selected</h4>
                <p style={{ fontSize: '13px', maxWidth: '360px' }}>Select an active design lot number from the left panel list to view its entire workflow sequence timeline.</p>
              </div>
            ) : viewMode === 'pipeline' ? (
              /* Step-by-Step Pipeline View */
              <div style={{ position: 'relative', paddingLeft: '24px' }}>
                {/* Vertical Connector Line */}
                <div style={{
                  position: 'absolute', left: '9px', top: '12px', bottom: '12px',
                  width: '2px', backgroundColor: 'var(--border-color)', zIndex: 1
                }}></div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {visibleSteps.map((step, idx) => (
                    <div key={step.id} style={{ position: 'relative', display: 'flex', gap: '16px', zIndex: 2 }}>
                      {/* Node circle */}
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: step.isComplete ? 'var(--success)' : 'var(--bg-primary)',
                        border: '3px solid',
                        borderColor: step.isComplete ? 'var(--success)' : 'var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        flexShrink: 0,
                        marginTop: '3px',
                        boxShadow: '0 0 0 4px var(--bg-secondary)'
                      }}>
                        {step.isComplete && <Check size={10} strokeWidth={3} />}
                      </div>

                      {/* Content panel */}
                      <div className="panel" style={{
                        flex: 1,
                        padding: '14px 18px',
                        margin: 0,
                        boxShadow: 'var(--shadow-sm)',
                        borderColor: step.isComplete ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color)',
                        opacity: step.isComplete ? 1 : 0.75,
                        backgroundColor: step.isComplete ? 'var(--bg-secondary)' : 'rgba(0,0,0,0.01)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: step.isComplete ? 'var(--success)' : 'var(--text-light)', display: 'inline-flex' }}>{step.icon}</span>
                            <span>{step.name}</span>
                          </span>

                          <span style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: step.isComplete ? 'var(--success-light)' : 'rgba(148, 163, 184, 0.1)',
                            color: step.isComplete ? 'var(--success)' : 'var(--text-muted)'
                          }}>
                            {step.isComplete ? 'Complete' : 'Pending'}
                          </span>
                        </div>

                        {step.isComplete && step.date && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            <span>Completed: <strong>{formatDateTime(step.date)}</strong></span>
                            {step.actor && <span style={{ marginLeft: '12px' }}>by <strong>{step.actor}</strong></span>}
                          </div>
                        )}

                        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '10px', paddingTop: '10px' }}>
                          {step.details}

                          {/* Nested Scanner Sub-Steps */}
                          {step.isComplete && step.subSteps && step.subSteps.length > 0 && (
                            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Scanner Activity Log
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {step.subSteps.map(sub => (
                                  <div key={sub.id} style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: sub.done
                                      ? 'rgba(16, 185, 129, 0.06)'
                                      : 'rgba(148, 163, 184, 0.05)',
                                    border: '1px solid',
                                    borderColor: sub.done ? 'rgba(16,185,129,0.2)' : 'var(--border-color)'
                                  }}>
                                    {/* Sub-step indicator */}
                                    <div style={{
                                      width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                                      backgroundColor: sub.done ? 'var(--success)' : 'transparent',
                                      border: '2px solid',
                                      borderColor: sub.done ? 'var(--success)' : 'var(--border-color)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                                    }}>
                                      {sub.done && <Check size={8} strokeWidth={3} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: sub.done ? 'var(--text-main)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                          <span>{sub.icon}</span>
                                          <span>{sub.label}</span>
                                        </span>
                                        <span style={{
                                          fontSize: '10px', fontWeight: '600', padding: '1px 7px', borderRadius: '10px',
                                          backgroundColor: sub.done ? 'var(--success-light)' : 'rgba(148,163,184,0.1)',
                                          color: sub.done ? 'var(--success)' : 'var(--text-muted)'
                                        }}>
                                          {sub.done ? '✓ Scanned' : 'Not Scanned'}
                                        </span>
                                      </div>
                                      {sub.done && sub.data && (
                                        <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                          <span>👤 <strong>{sub.data.person_name}</strong></span>
                                          <span>🏭 <strong>{sub.data.supplier_name}</strong></span>
                                          {sub.data.material_name && <span>📋 {sub.data.material_name}</span>}
                                          {sub.data.quantity > 0 && <span>🔢 {sub.data.quantity} pcs</span>}
                                          <span>🕐 {formatDateTime(sub.data.scanned_at)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : timelineEvents.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <AlertCircle size={40} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>No timeline logs found</h4>
                <p style={{ fontSize: '13px', maxWidth: '360px' }}>We couldn't compile logs for this lot ID. Check if there are design status updates or scans linked to this lot.</p>
              </div>
            ) : (
              /* Original Timeline view (Chronological Log) */
              <div style={{ position: 'relative', paddingLeft: '20px' }}>
                <div style={{
                  position: 'absolute', left: '7px', top: '10px', bottom: '10px',
                  width: '2px', backgroundColor: 'var(--border-color)', zIndex: 1
                }}></div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {timelineEvents.map((evt, idx) => (
                    <div key={idx} style={{ position: 'relative', display: 'flex', gap: '16px', zIndex: 2 }}>
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        backgroundColor: 'var(--bg-primary)', border: '3.5px solid',
                        borderColor: evt.color, flexShrink: 0, marginTop: '4px',
                        boxShadow: '0 0 0 3px var(--bg-primary)'
                      }}></div>

                      <div className="animate-scale" style={{
                        flex: 1, backgroundColor: 'var(--bg-secondary)',
                        border: '1.5px solid var(--border-color)', borderRadius: '10px',
                        padding: '14px 18px', boxShadow: 'var(--shadow-sm)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: evt.color, display: 'inline-flex' }}>{evt.icon}</span>
                            <span>{evt.title}</span>
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>{evt.timestamp}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          <span>by <strong>{evt.actor}</strong></span>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', color: 'var(--text-color)', fontSize: '13px' }}>
                          {evt.details}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const getLotVersionInfo = (lotNo, designs = []) => {
  const lotStr = String(lotNo || '').trim();
  if (lotStr.includes('-V')) {
    const parts = lotStr.split('-V');
    return {
      displayLot: parts[0],
      versionText: `Recreated (Run ${parts[1]})`,
      isRecreated: true
    };
  }
  return {
    displayLot: lotStr,
    versionText: 'Original Lot',
    isRecreated: false
  };
};
