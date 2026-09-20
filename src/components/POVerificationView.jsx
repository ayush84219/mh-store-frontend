import React, { useState, useEffect } from 'react';
import { getBackendUrl } from '../utils/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CheckCircle2, AlertTriangle, Scale, Search, Filter,
  TrendingDown, TrendingUp, Clock, Printer, FileText, Download,
  User, Calendar, Box, Tag, ArrowLeft, ArrowLeftRight, HelpCircle,
  X, Check, XCircle, ShieldCheck, AlertCircle
} from 'lucide-react';

const PaginationBar = ({ page, setPage, rpp, setRpp, totalItems, rppOptions = [5, 10, 20, 50] }) => {
  const totalPages = Math.ceil(totalItems / rpp) || 1;
  const start = totalItems === 0 ? 0 : page * rpp + 1;
  const end = Math.min((page + 1) * rpp, totalItems);

  if (totalItems <= 0) return null;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '16px',
      paddingTop: '12px',
      borderTop: '1px solid var(--border-color)',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
        Showing {start} to {end} of {totalItems} entries
      </span>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>Rows per page:</span>
        <select
          value={rpp}
          onChange={(e) => { setRpp(Number(e.target.value)); setPage(0); }}
          style={{
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '700',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-main)',
            cursor: 'pointer'
          }}
        >
          {rppOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className="btn btn-secondary btn-sm"
            style={{ padding: '5px 12px', fontSize: '11.5px', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}
          >
            Previous
          </button>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-main)' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            className="btn btn-secondary btn-sm"
            style={{ padding: '5px 12px', fontSize: '11.5px', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default function POVerificationView({ currencySymbol = 'R', currentUser }) {
  const isAdmin = currentUser?.role === 'Admin';
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [pos, setPOs] = useState([]);
  const [zipOrders, setZipOrders] = useState([]);
  const [dooriOrders, setDooriOrders] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [scans, setScans] = useState([]);
  
  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [selectedPO, setSelectedPO] = useState(null);
  const [activeViewTab, setActiveViewTab] = useState('report'); // 'report' | 'accepted' | 'timeline'
  const [toast, setToast] = useState(null);

  // Pagination states
  const [allPoPage, setAllPoPage] = useState(0);
  const [allPoRpp, setAllPoRpp] = useState(10);

  const [acceptedPage, setAcceptedPage] = useState(0);
  const [acceptedRpp, setAcceptedRpp] = useState(10);

  const [timelinePage, setTimelinePage] = useState(0);
  const [timelineRpp, setTimelineRpp] = useState(10);

  const [modalStepPage, setModalStepPage] = useState(0);
  const [modalStepRpp, setModalStepRpp] = useState(5);

  // Fetch all necessary data
  const fetchData = async () => {
    setLoading(true);
    try {
      const backendUrl = getBackendUrl();
      
      const [posRes, zipRes, dooriRes, capturesRes, scansRes] = await Promise.all([
        fetch(`${backendUrl}/api/pos`),
        fetch(`${backendUrl}/api/zip-orders`),
        fetch(`${backendUrl}/api/doori-orders`),
        fetch(`${backendUrl}/api/weight-capture`),
        fetch(`${backendUrl}/api/scans`)
      ]);

      const posData = posRes.ok ? await posRes.json() : [];
      const zipData = zipRes.ok ? await zipRes.json() : [];
      const dooriData = dooriRes.ok ? await dooriRes.json() : [];
      const capturesData = capturesRes.ok ? await capturesRes.json() : [];
      const scansData = scansRes.ok ? await scansRes.json() : [];

      setPOs(Array.isArray(posData) ? posData : []);
      setZipOrders(Array.isArray(zipData) ? zipData : []);
      setDooriOrders(Array.isArray(dooriData) ? dooriData : []);
      setScans(Array.isArray(scansData) ? scansData : []);
      
      // Fix potential payload wrapping
      const rawCaptures = capturesData.data ? capturesData.data : capturesData;
      const cleanCaptures = Array.isArray(rawCaptures) ? rawCaptures : [];
      setCaptures(cleanCaptures);
    } catch (err) {
      console.error('Error fetching PO/Capture data:', err);
      showToast('Error', 'Failed to load PO verification data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (title, message, type = 'success') => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Compile Unified PO Data List
  const unifiedPOs = React.useMemo(() => {
    const list = [];

    // 1. General POs
    pos.forEach(p => {
      let itemsList = [];
      try {
        itemsList = typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []);
      } catch (_) {
        itemsList = [];
      }
      
      const totalOrdered = itemsList.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      
      list.push({
        poNumber: p.poNumber || p.id,
        vendor: p.vendorName || 'Unknown Vendor',
        date: p.date || 'N/A',
        type: 'General',
        items: itemsList.map(item => ({
          name: item.name || item.description || item.item || 'Trim Item',
          dept: item.department || item.dept || item.category || 'Trims',
          department: item.department || item.dept || item.category || 'Trims',
          shade: item.shade || item.color || '',
          uom: item.uom || item.unit || 'PCS',
          ordered: Number(item.qty || item.quantity) || 0,
          price: Number(item.price || item.rate) || 50,
          total: (Number(item.qty || item.quantity) || 0) * (Number(item.price || item.rate) || 50)
        })),
        totalOrdered,
        totalCost: p.total || 0,
        status: p.status || 'Active'
      });
    });



    // 4. RGP POs (Returnable Gate Pass documents from scans table)
    const rgpScans = scans.filter(s => s.scan_type === 'rgp_entry' && s.rgp_payload);
    rgpScans.forEach(s => {
      let rgpPayload = null;
      let itemsList = [];
      try {
        rgpPayload = typeof s.rgp_payload === 'string' ? JSON.parse(s.rgp_payload) : s.rgp_payload;
        if (rgpPayload && Array.isArray(rgpPayload.entries)) {
          itemsList = rgpPayload.entries.map(entry => ({
            name: entry.desc || 'Trim/Fabric Description',
            ordered: Number(entry.qty1) || Number(entry.tQty) || 0,
            lotNo: entry.lotNo || '',
            dept: entry.dept || 'Stitching',
            purpose: entry.purpose || 'Stitching',
            uom: entry.uom || 'Pcs',
            bags: entry.bags || '0'
          }));
        }
      } catch (_) {}

      if (itemsList.length === 0) {
        itemsList = [{ name: s.material_name || 'RGP Issued Items', ordered: s.quantity || 0 }];
      }

      list.push({
        poNumber: s.lot_number || `RGP-${s.id}`,
        vendor: s.supplier_name || 'Unknown Vendor',
        date: rgpPayload?.date || new Date(s.timestamp || s.createdAt || Date.now()).toLocaleDateString('en-GB'),
        type: 'RGP',
        items: itemsList,
        totalOrdered: s.quantity || itemsList.reduce((sum, item) => sum + item.ordered, 0),
        totalCost: 0,
        status: 'Issued',
        // RGP specific properties
        expectedReturnDate: rgpPayload?.expectedReturnDate || 'N/A',
        vehicleNo: rgpPayload?.vehicleNo || 'N/A',
        preparedBy: rgpPayload?.preparedBy || s.person_name || 'System',
        authorizedBy: rgpPayload?.authorizedBy || 'N/A',
        remarks: rgpPayload?.remarks || 'N/A'
      });
    });

    // Add matching weight captures
    return list.map(po => {
      // Clean and normalize PO Number
      const cleanPo = str => String(str || '').trim().toLowerCase().replace(/^po-?/i, '');
      const normPo = cleanPo(po.poNumber);
      
      // Filter weight captures that match this PO and sort chronologically
      const matchingCaptures = captures
        .filter(cap => cap.poNumber && cleanPo(cap.poNumber) === normPo)
        .sort((a, b) => {
          const tA = new Date(a.capturedAt || a.date || 0).getTime() || Number(a.id || 0);
          const tB = new Date(b.capturedAt || b.date || 0).getTime() || Number(b.id || 0);
          return tA - tB;
        });

      let cumulative = 0;
      let approvedReceived = 0;
      let pendingApprovalPieces = 0;
      let rejectedPieces = 0;
      let pendingApprovalCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;

      const partialEntries = matchingCaptures.map((cap, idx) => {
        const pcs = Number(cap.pieces) || 0;
        const appStatus = cap.approvalStatus || (cap.status === 'Pending Approval' ? 'Pending Approval' : (cap.status === 'Rejected' ? 'Rejected' : 'Approved'));
        const isApproved = appStatus === 'Approved';
        const isRejected = appStatus === 'Rejected';
        const isPending = appStatus === 'Pending Approval';

        if (isPending) {
          pendingApprovalCount++;
          pendingApprovalPieces += pcs;
        } else if (isApproved) {
          approvedCount++;
          approvedReceived += pcs;
        } else if (isRejected) {
          rejectedCount++;
          rejectedPieces += pcs;
        }

        // Only approved / active receipts count towards cumulative received stock
        if (isApproved) {
          cumulative += pcs;
        }

        const remaining = Math.max(0, po.totalOrdered - cumulative);
        const extra = cumulative > po.totalOrdered ? cumulative - po.totalOrdered : 0;
        const isCompletedStep = po.totalOrdered > 0 && cumulative >= po.totalOrdered;

        let entryDate = 'N/A';
        if (cap.capturedAt) {
          entryDate = new Date(cap.capturedAt).toLocaleString('en-GB');
        } else if (cap.date) {
          entryDate = `${cap.date} ${cap.time || ''}`.trim();
        }

        // Resolve specific product / item name (e.g. Zip, Rib, Dori, Button, or PO item name)
        let resolvedItemName = String(cap.materialName || cap.category || '').trim();
        if (!resolvedItemName || resolvedItemName.toLowerCase() === 'trims' || resolvedItemName.toLowerCase() === 'trim' || resolvedItemName.toLowerCase() === 'item') {
          if (po.items && po.items.length > 0) {
            resolvedItemName = po.items[0].name || (po.type === 'Zip' ? 'Zip' : (po.type === 'Doori' ? 'Dori' : 'Trim Item'));
          } else {
            resolvedItemName = po.type === 'Zip' ? 'Zip' : (po.type === 'Doori' ? 'Dori' : 'Rib / Trim');
          }
        }

        let stepStatus = isCompletedStep ? 'Accepted' : 'Pending (Partial)';
        if (isPending) stepStatus = 'Pending Approval';
        if (isRejected) stepStatus = 'Rejected by Admin';

        const entryModeStr = (cap.entryMode === 'Manual' || cap.entryMode === 'Manually' || cap.status === 'Manual' || cap.status === 'Manually') ? 'Manually' : 'Weight Machine';

        return {
          stepNo: idx + 1,
          id: cap.id,
          date: entryDate,
          invoiceNo: cap.invoiceNo || cap.billNo || 'N/A',
          materialName: resolvedItemName,
          materialCode: cap.materialCode || 'N/A',
          orderedQty: po.totalOrdered,
          receivedQty: pcs,
          cumulativeReceived: cumulative,
          extraQty: extra,
          remainingBalance: remaining,
          entryMode: entryModeStr,
          unit: cap.unit || 'Pcs',
          barcodeId: cap.barcodeId || 'N/A',
          netWeightKg: Number(cap.netWeightKg) || 0,
          grossWeightKg: Number(cap.grossWeightKg) || 0,
          tareWeightKg: Number(cap.tareWeightKg) || 0,
          weightPerPieceG: Number(cap.weightPerPieceG) || 0,
          packets: Number(cap.packets) || 1,
          location: cap.storeLocation || 'Main Store',
          operator: cap.storeIncharge || 'Store Operator',
          approvalStatus: appStatus,
          approvedBy: cap.approvedBy,
          rejectionReason: cap.rejectionReason,
          remarks: cap.remarks || '',
          stepStatus
        };
      });

      const hasPendingApproval = pendingApprovalCount > 0;
      const hasRejected = rejectedCount > 0 && approvedCount === 0 && !hasPendingApproval;
      const totalReceived = approvedReceived;
      const pendingBalance = Math.max(0, po.totalOrdered - totalReceived);
      const extraBalance = Math.max(0, totalReceived - po.totalOrdered);
      
      // Calculate received items distribution across PO items
      const itemizedReceived = {};
      (po.items || []).forEach(it => {
        itemizedReceived[it.name] = 0;
      });

      matchingCaptures.forEach(cap => {
        if (cap.approvalStatus === 'Rejected') return; // Skip rejected items in stock allocation
        const rawName = String(cap.materialName || cap.category || '').trim().toLowerCase();
        const capPcs = Number(cap.pieces) || 0;
        
        let foundItem = (po.items || []).find(it => it.name.toLowerCase() === rawName);
        if (!foundItem) {
          foundItem = (po.items || []).find(it => 
            it.name.toLowerCase().includes(rawName) || 
            (rawName && rawName.includes(it.name.toLowerCase()))
          );
        }
        if (foundItem) {
          itemizedReceived[foundItem.name] += capPcs;
        }
      });

      // If no item-level match occurred (e.g. captures labeled as "Trims"), allocate sequentially to PO items
      const totalItemized = Object.values(itemizedReceived).reduce((a, b) => a + b, 0);
      if (totalItemized === 0 && po.items && po.items.length > 0 && cumulative > 0) {
        let left = cumulative;
        po.items.forEach(it => {
          const needed = Number(it.ordered) || 0;
          const allocated = Math.min(left, needed);
          itemizedReceived[it.name] = allocated;
          left -= allocated;
        });
        if (left > 0 && po.items.length > 0) {
          itemizedReceived[po.items[0].name] += left;
        }
      }

      // Verification & PO Status
      let verificationStatus = 'Pending';
      let poStatus = 'Pending Inward';
      if (hasPendingApproval) {
        verificationStatus = 'Pending Approval';
        poStatus = 'Pending Approval';
      } else if (hasRejected) {
        verificationStatus = 'Rejected';
        poStatus = 'Rejected';
      } else if (approvedReceived > 0) {
        if (approvedReceived > po.totalOrdered) {
          verificationStatus = 'Excess';
          poStatus = 'Accepted';
        } else if (approvedReceived === po.totalOrdered) {
          verificationStatus = 'Matched';
          poStatus = 'Accepted';
        } else {
          verificationStatus = 'Shortage';
          poStatus = 'Pending (Partial)';
        }
      } else if (rejectedCount > 0) {
        verificationStatus = 'Rejected';
        poStatus = 'Rejected';
      } else {
        verificationStatus = 'Pending';
        poStatus = 'Pending Inward';
      }

      return {
        ...po,
        matchingCaptures,
        partialEntries,
        hasPendingApproval,
        hasRejected,
        pendingApprovalCount,
        approvedReceived,
        pendingApprovalPieces,
        rejectedPieces,
        approvedCount,
        rejectedCount,
        totalReceived,
        pendingBalance,
        extraBalance,
        poStatus,
        itemizedReceived,
        verificationStatus,
        isExcess: extraBalance > 0,
        isShortage: pendingBalance > 0 && totalReceived > 0,
        isMatched: totalReceived === po.totalOrdered && po.totalOrdered > 0,
        isPending: totalReceived === 0 && !hasRejected && !hasPendingApproval,
        lastCapturedAt: matchingCaptures.length > 0 ? matchingCaptures[matchingCaptures.length - 1].capturedAt : null
      };
    });
  }, [pos, zipOrders, dooriOrders, captures, scans]);

  // Aggregate orphan weight captures (captures with a PO Number or direct inward that does not exist in our PO tables)
  const orphanCaptures = React.useMemo(() => {
    const cleanPo = str => String(str || '').trim().toLowerCase().replace(/^po-?/i, '');
    const knownPoNumbers = new Set(unifiedPOs.map(po => cleanPo(po.poNumber)));
    
    // Group captures by PO Number or Direct Inward code
    const grouped = {};
    captures.forEach(cap => {
      const poNum = (cap.poNumber && String(cap.poNumber).trim() && String(cap.poNumber).trim().toUpperCase() !== 'N/A')
        ? String(cap.poNumber).trim()
        : (cap.materialCode ? `Direct Inward (${cap.materialCode})` : `Direct Inward #${cap.id}`);
      const norm = cleanPo(poNum);
      if (!knownPoNumbers.has(norm)) {
        const entryModeStr = (cap.entryMode === 'Manual' || cap.entryMode === 'Manually' || cap.status === 'Manual' || cap.status === 'Manually') ? 'Manually' : 'Weight Machine';
        
        if (!grouped[norm]) {
          grouped[norm] = {
            poNumber: poNum,
            vendor: cap.supplier || (poNum.startsWith('Direct Inward') ? 'Direct Material Inward' : 'Unregistered Supplier'),
            date: cap.capturedAt ? new Date(cap.capturedAt).toLocaleDateString('en-GB') : (cap.date || 'N/A'),
            type: poNum.startsWith('Direct Inward') ? 'Direct Inward' : 'Unregistered PO',
            entryMode: entryModeStr,
            items: [{
              name: cap.materialName || cap.category || 'Accessory Material',
              dept: cap.category || 'Trims',
              department: cap.category || 'Trims',
              uom: cap.unit || 'Pcs',
              ordered: Number(cap.pieces) || 0
            }],
            totalOrdered: 0,
            totalCost: 0,
            totalReceived: 0,
            approvedReceived: 0,
            rejectedPieces: 0,
            pendingApprovalPieces: 0,
            approvedCount: 0,
            rejectedCount: 0,
            pendingApprovalCount: 0,
            hasPendingApproval: false,
            hasRejected: false,
            matchingCaptures: [],
            partialEntries: [],
            verificationStatus: 'Excess',
            poStatus: 'Accepted',
            lastCapturedAt: null
          };
        }
        const pcs = Number(cap.pieces) || 0;
        const appStatus = cap.approvalStatus || (cap.status === 'Pending Approval' ? 'Pending Approval' : (cap.status === 'Rejected' ? 'Rejected' : 'Approved'));
        if (appStatus === 'Rejected') {
          grouped[norm].rejectedPieces += pcs;
          grouped[norm].rejectedCount++;
        } else if (appStatus === 'Pending Approval') {
          grouped[norm].pendingApprovalPieces += pcs;
          grouped[norm].pendingApprovalCount++;
          grouped[norm].hasPendingApproval = true;
          grouped[norm].poStatus = 'Pending Approval';
          grouped[norm].verificationStatus = 'Pending Approval';
        } else {
          grouped[norm].approvedReceived += pcs;
          grouped[norm].totalReceived += pcs;
          grouped[norm].approvedCount++;
        }
        if (grouped[norm].approvedCount === 0 && grouped[norm].rejectedCount > 0 && !grouped[norm].hasPendingApproval) {
          grouped[norm].hasRejected = true;
          grouped[norm].poStatus = 'Rejected';
          grouped[norm].verificationStatus = 'Rejected';
        }

        let entryDate = 'N/A';
        if (cap.capturedAt) {
          entryDate = new Date(cap.capturedAt).toLocaleString('en-GB');
        } else if (cap.date) {
          entryDate = `${cap.date} ${cap.time || ''}`.trim();
        }

        grouped[norm].partialEntries.push({
          stepNo: grouped[norm].partialEntries.length + 1,
          id: cap.id,
          date: entryDate,
          invoiceNo: cap.invoiceNo || cap.billNo || 'N/A',
          materialName: cap.materialName || cap.category || 'Trim Item',
          materialCode: cap.materialCode || 'N/A',
          orderedQty: 0,
          receivedQty: pcs,
          cumulativeReceived: grouped[norm].approvedReceived,
          extraQty: pcs,
          remainingBalance: 0,
          entryMode: entryModeStr,
          unit: cap.unit || 'Pcs',
          barcodeId: cap.barcodeId || 'N/A',
          netWeightKg: Number(cap.netWeightKg) || 0,
          grossWeightKg: Number(cap.grossWeightKg) || 0,
          tareWeightKg: Number(cap.tareWeightKg) || 0,
          weightPerPieceG: Number(cap.weightPerPieceG) || 0,
          packets: Number(cap.packets) || 1,
          location: cap.storeLocation || 'Main Store',
          operator: cap.storeIncharge || 'Store Operator',
          approvalStatus: appStatus,
          approvedBy: cap.approvedBy,
          rejectionReason: cap.rejectionReason,
          remarks: cap.remarks || '',
          stepStatus: appStatus === 'Rejected' ? 'Rejected by Admin' : (appStatus === 'Pending Approval' ? 'Pending Approval' : 'Accepted')
        });

        grouped[norm].matchingCaptures.push(cap);
        if (!grouped[norm].lastCapturedAt || new Date(cap.capturedAt) > new Date(grouped[norm].lastCapturedAt)) {
          grouped[norm].lastCapturedAt = cap.capturedAt;
        }
      }
    });

    return Object.values(grouped);
  }, [unifiedPOs, captures]);

  // Unique materials extracted across all POs & receipts
  const uniqueMaterials = React.useMemo(() => {
    const all = [...unifiedPOs, ...orphanCaptures];
    const matSet = new Set();
    all.forEach(po => {
      if (Array.isArray(po.items)) {
        po.items.forEach(it => {
          const n = (it.name || it.description || it.item || '').trim();
          if (n) matSet.add(n);
        });
      }
      if (Array.isArray(po.rawCaptures)) {
        po.rawCaptures.forEach(c => {
          const m = (c.material || c.material_name || '').trim();
          if (m) matSet.add(m);
        });
      }
    });
    return Array.from(matSet).sort();
  }, [unifiedPOs, orphanCaptures]);

  // Combined List for view
  const displayPOs = React.useMemo(() => {
    const all = [...unifiedPOs, ...orphanCaptures];
    
    // Apply search query & filters
    return all.filter(po => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        String(po.poNumber || '').toLowerCase().includes(q) ||
        String(po.vendor || '').toLowerCase().includes(q) ||
        (Array.isArray(po.items) && po.items.some(it => String(it.name || it.dept || it.shade || '').toLowerCase().includes(q))) ||
        (Array.isArray(po.rawCaptures) && po.rawCaptures.some(c => String(c.material || c.category || '').toLowerCase().includes(q)))
      );
      
      const matchesStatus = statusFilter === 'all' || 
        po.verificationStatus.toLowerCase() === statusFilter.toLowerCase();
      
      const matchesType = typeFilter === 'all' || 
        po.type.toLowerCase() === typeFilter.toLowerCase();

      const matchesMaterial = materialFilter === 'all' || (
        (Array.isArray(po.items) && po.items.some(it => String(it.name || it.description || it.item || '').toLowerCase() === materialFilter.toLowerCase())) ||
        (Array.isArray(po.rawCaptures) && po.rawCaptures.some(c => String(c.material || c.material_name || '').toLowerCase() === materialFilter.toLowerCase()))
      );

      return matchesSearch && matchesStatus && matchesType && matchesMaterial;
    });
  }, [unifiedPOs, orphanCaptures, searchQuery, statusFilter, typeFilter, materialFilter]);

  // Dedicated Accepted Orders List
  const acceptedOrders = React.useMemo(() => {
    return displayPOs.filter(po => {
      const isAccepted = !po.hasPendingApproval && !po.hasRejected && (
        po.poStatus === 'Accepted' || 
        po.poStatus === 'Completed' || 
        po.verificationStatus === 'Matched' || 
        (po.totalOrdered > 0 && po.approvedReceived >= po.totalOrdered) ||
        (po.approvedReceived > 0 && po.rejectedCount === 0 && !po.hasPendingApproval)
      );
      return isAccepted;
    });
  }, [displayPOs]);

  // Reset pagination on filter or search changes
  useEffect(() => {
    setAllPoPage(0);
    setAcceptedPage(0);
  }, [searchQuery, statusFilter, typeFilter, materialFilter]);

  // Reset modal step page when selecting a PO
  useEffect(() => {
    setModalStepPage(0);
  }, [selectedPO]);

  // Paginated Data Slices
  const paginatedAllPOs = React.useMemo(() => {
    const start = allPoPage * allPoRpp;
    return displayPOs.slice(start, start + allPoRpp);
  }, [displayPOs, allPoPage, allPoRpp]);
  const totalAllPoPages = Math.ceil(displayPOs.length / allPoRpp) || 1;

  const paginatedAcceptedOrders = React.useMemo(() => {
    const start = acceptedPage * acceptedRpp;
    return acceptedOrders.slice(start, start + acceptedRpp);
  }, [acceptedOrders, acceptedPage, acceptedRpp]);
  const totalAcceptedPages = Math.ceil(acceptedOrders.length / acceptedRpp) || 1;

  const paginatedCaptures = React.useMemo(() => {
    const start = timelinePage * timelineRpp;
    return captures.slice(start, start + timelineRpp);
  }, [captures, timelinePage, timelineRpp]);
  const totalTimelinePages = Math.ceil(captures.length / timelineRpp) || 1;

  const paginatedModalSteps = React.useMemo(() => {
    if (!selectedPO?.partialEntries) return [];
    const start = modalStepPage * modalStepRpp;
    return selectedPO.partialEntries.slice(start, start + modalStepRpp);
  }, [selectedPO, modalStepPage, modalStepRpp]);
  const totalModalStepPages = selectedPO?.partialEntries ? (Math.ceil(selectedPO.partialEntries.length / modalStepRpp) || 1) : 1;

  // Statistics calculations
  const stats = React.useMemo(() => {
    const all = [...unifiedPOs, ...orphanCaptures];
    const total = all.length;
    const matched = all.filter(p => !p.hasPendingApproval && !p.hasRejected && (p.poStatus === 'Accepted' || p.poStatus === 'Completed' || p.verificationStatus === 'Matched' || (p.totalOrdered > 0 && p.approvedReceived >= p.totalOrdered) || (p.approvedReceived > 0 && p.rejectedCount === 0))).length;
    const shortages = all.filter(p => !p.hasPendingApproval && !p.hasRejected && p.verificationStatus === 'Shortage').length;
    const excess = all.filter(p => !p.hasPendingApproval && !p.hasRejected && (p.verificationStatus === 'Excess' || p.isExcess)).length;
    const pending = all.filter(p => p.hasPendingApproval || p.poStatus === 'Pending Approval' || p.poStatus === 'Pending Inward' || p.isPending).length;
    const rejected = all.filter(p => p.hasRejected || p.poStatus === 'Rejected' || p.verificationStatus === 'Rejected').length;

    return { total, matched, shortages, excess, pending, rejected };
  }, [unifiedPOs, orphanCaptures]);

  const handleApproveInward = async (captureId) => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/inward/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: captureId,
          approvedBy: currentUser?.name || 'Admin',
          note: 'Approved by Manager'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Approved', 'Inward receipt approved! Stock and warehouse location finalized.', 'success');
        fetchData();
        setSelectedPO(null);
      } else {
        showToast('Error', data.error || 'Failed to approve inward receipt', 'error');
      }
    } catch (err) {
      showToast('Error', err.message || 'Connection error', 'error');
    }
  };

  const handleRejectInward = async (captureId) => {
    const reason = window.prompt('Please enter the reason for rejecting this inward shipment:');
    if (reason === null) return;
    try {
      const res = await fetch(`${getBackendUrl()}/api/inward/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: captureId,
          rejectedBy: currentUser?.name || 'Admin',
          reason: reason || 'Rejected by Admin (excess / discrepancy)'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Rejected', 'Inward receipt rejected. Stock excluded and returned to vendor.', 'info');
        fetchData();
        setSelectedPO(null);
      } else {
        showToast('Error', data.error || 'Failed to reject inward receipt', 'error');
      }
    } catch (err) {
      showToast('Error', err.message || 'Connection error', 'error');
    }
  };

  const handlePrintVerificationReport = (po) => {
    const isAdmin = currentUser?.role === 'Admin';
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Error', 'Popup blocker is preventing document export.', 'error');
      return;
    }

    const difference = po.totalReceived - po.totalOrdered;
    const percentage = po.totalOrdered > 0 
      ? ((po.totalReceived / po.totalOrdered) * 100).toFixed(1) 
      : '0.0';
    const percentageDiff = po.totalOrdered > 0
      ? (((po.totalReceived - po.totalOrdered) / po.totalOrdered) * 100).toFixed(1)
      : '0.0';

    const varianceVal = Math.abs(parseFloat(percentageDiff));
    const isApproved = varianceVal <= 5.0;
    
    // Status box HTML (Black and White)
    let approvalStatusHtml = '';
    if (po.totalReceived === 0) {
      approvalStatusHtml = `
        <div style="border: 1.5px solid #000000; background-color: #f3f4f6; color: #000000; padding: 8px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; text-align: center; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Inter', sans-serif;">
          ⏳ STATUS: PENDING INWARD (0 of ${po.totalOrdered} pcs received • Outstanding: ${po.totalOrdered} pcs)
        </div>
      `;
    } else if (po.totalReceived < po.totalOrdered) {
      approvalStatusHtml = `
        <div style="border: 1.5px solid #000000; background-color: #fff7ed; color: #000000; padding: 8px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; text-align: center; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Inter', sans-serif;">
          ⏳ STATUS: PENDING (PARTIAL) — Received ${po.totalReceived} of ${po.totalOrdered} pcs (${po.totalOrdered - po.totalReceived} pcs pending)
        </div>
      `;
    } else if (isApproved) {
      approvalStatusHtml = `
        <div style="border: 1.5px solid #000000; background-color: #f3f4f6; color: #000000; padding: 8px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; text-align: center; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Inter', sans-serif;">
          ✔ STATUS: COMPLETED & VERIFIED (Received ${po.totalReceived} of ${po.totalOrdered} pcs)
        </div>
      `;
    } else {
      approvalStatusHtml = `
        <div style="border: 2px dashed #000000; background-color: #ffffff; color: #000000; padding: 8px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; text-align: center; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Inter', sans-serif;">
          ⚠ STATUS: OVER-DELIVERY / REQUIRES AUTHORIZATION (Received ${po.totalReceived} pcs, +${po.totalReceived - po.totalOrdered} pcs extra)
        </div>
      `;
    }

    // Signature lines HTML (Black and White)
    const signatureHtml = `
      <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-start; font-size: 12px; gap: 40px; font-family: 'Inter', sans-serif;">
        <div style="text-align: center; flex: 1;">
          <div style="height: 25px;"></div>
          <div style="border-top: 1.5px solid #000000; padding-top: 6px; font-weight: bold; color: #000;">Store In-Charge Signature</div>
        </div>
        <div style="text-align: center; flex: 1;">
          <div style="height: 25px;"></div>
          <div style="border-top: 1.5px solid #000000; padding-top: 6px; font-weight: bold; color: #000;">Audited & Verified By</div>
        </div>
        ${!isApproved ? `
          <div style="text-align: center; flex: 1; border: 1.2px dashed #000000; padding: 8px 10px; border-radius: 4px; background-color: #ffffff;">
            <div style="font-size: 9px; color: #000000; font-weight: 800; text-transform: uppercase; margin-bottom: 12px;">⚠ Authorization Required</div>
            <div style="border-top: 1.2px solid #000000; padding-top: 6px; font-weight: bold; color: #000000; font-size: 11px;">Authorized Signature</div>
          </div>
        ` : ''}
      </div>
    `;

    const rgpSignatureHtml = `
      <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-start; font-size: 12px; gap: 40px; font-family: 'Inter', sans-serif;">
        <div style="text-align: center; flex: 1;">
          <div style="height: 25px;"></div>
          <div style="border-top: 1.5px solid #000000; padding-top: 6px; font-weight: bold; color: #000;">Security Officer Signature</div>
        </div>
        <div style="text-align: center; flex: 1;">
          <div style="height: 25px;"></div>
          <div style="border-top: 1.5px solid #000000; padding-top: 6px; font-weight: bold; color: #000;">Store In-Charge Signature</div>
        </div>
        ${!isApproved ? `
          <div style="text-align: center; flex: 1; border: 1.2px dashed #000000; padding: 8px 10px; border-radius: 4px; background-color: #ffffff;">
            <div style="font-size: 9px; color: #000000; font-weight: 800; text-transform: uppercase; margin-bottom: 12px;">⚠ Authorization Required</div>
            <div style="border-top: 1.2px solid #000000; padding-top: 6px; font-weight: bold; color: #000000; font-size: 11px;">Authorized Signature</div>
          </div>
        ` : ''}
      </div>
    `;

    let printTemplate = '';

    if (po.type === 'General') {
      const rowsHtml = (po.items || []).map((item, idx) => {
        const received = po.itemizedReceived && po.itemizedReceived[item.name] !== undefined 
          ? po.itemizedReceived[item.name] 
          : (po.items.length === 1 ? po.totalReceived : 0);
        
        const rate = item.price || 50.00;
        const amount = (item.ordered * rate).toFixed(2);
        const itemCategory = item.dept || item.department || item.category || 'Trims';

        return `
          <tr style="border-bottom: 1px solid #000000;">
            <td style="padding: 5px; font-size: 11px; text-align: center;">${idx + 1}</td>
            <td style="padding: 5px; font-size: 11px;">${itemCategory}</td>
            <td style="padding: 5px; font-size: 11px; font-weight: bold; color: #000000;">${item.name}</td>
            <td style="padding: 5px; font-size: 11px;">${item.shade || ''}</td>
            <td style="padding: 5px; font-size: 11px; text-align: center;">${item.uom || 'PCS'}</td>
            <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">${item.ordered}</td>
            <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold; color: ${received >= item.ordered ? '#065f46' : '#000'};">${received}</td>
            ${isAdmin ? `
              <td style="padding: 5px; font-size: 11px; text-align: right;">${rate.toFixed(2)}</td>
              <td style="padding: 5px; font-size: 11px; text-align: right;">${amount}</td>
            ` : ''}
          </tr>
        `;
      }).join('');

      const subtotal = (po.items || []).reduce((sum, item) => sum + (item.ordered * (item.price || 50.00)), 0);
      const gst = subtotal * 0.12;
      const grandTotal = subtotal + gst;

      printTemplate = `
        <html>
          <head>
            <title>Purchase Order Original - ${po.poNumber}</title>
            <style>
              body { font-family: 'Inter', sans-serif; color: #000000; margin: 0; padding: 15px; background-color: #ffffff; line-height: 1.2; }
              .header-title { text-align: center; font-size: 16px; font-weight: bold; border-bottom: 2px solid #000000; padding-bottom: 4px; margin-bottom: 12px; text-transform: uppercase; }
              .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
              .border-box { border: 1px solid #000000; border-radius: 4px; padding: 8px; }
              .box-title { font-size: 10px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 2px; margin-bottom: 6px; }
              .box-row { font-size: 11px; margin-bottom: 2px; }
              .box-row strong { font-weight: bold; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1.5px solid #000000; }
              th, td { border: 1px solid #000000; padding: 5px 8px; font-size: 11px; }
              th { text-transform: uppercase; text-align: left; font-weight: 800; background-color: #eee; }
              @media print {
                @page { size: portrait; margin: 6mm; }
                body { padding: 0; margin: 0; }
              }
            </style>
          </head>
          <body>
            <div class="header-title">PURCHASE ORDER (ORIGINAL)</div>
            
            <div class="details-grid">
              <div class="border-box">
                <div class="box-title">PO DETAILS</div>
                <div class="box-row"><strong>PO #:</strong> ${po.poNumber}</div>
                <div class="box-row"><strong>Order Date/Time:</strong> ${po.date}</div>
                <div class="box-row"><strong>Requisition Raised By:</strong> NITIN KHANNA</div>
                <div class="box-row"><strong>Prepared By:</strong> RASHMI</div>
                <div class="box-row"><strong>Approved By:</strong> MOHIT GOYAL</div>
              </div>
              
              <div class="border-box">
                <div class="box-title">SUPPLIER</div>
                <div class="box-row"><strong>Name:</strong> ${po.vendor}</div>
                <div class="box-row"><strong>Phone:</strong> 24568563</div>
                <div class="box-row"><strong>Email:</strong> sales@vendor.com</div>
              </div>
            </div>

            <div style="background-color: #ffffff; border: 1.5px solid #000000; padding: 6px 12px; border-radius: 4px; margin-bottom: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
              <div>
                <div style="font-size: 8px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; color: #000;">PO Order Qty</div>
                <div style="font-size: 13px; font-weight: 800;">${po.totalOrdered} pcs</div>
              </div>
              <div>
                <div style="font-size: 8px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; color: #000;">Total Received</div>
                <div style="font-size: 13px; font-weight: 800;">${po.totalReceived} pcs</div>
              </div>
              <div>
                <div style="font-size: 8px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; color: #000;">Receipt Difference</div>
                <div style="font-size: 13px; font-weight: 800;">
                  ${difference === 0 ? '0' : (difference > 0 ? `+${difference}` : difference)} pcs
                </div>
              </div>
              <div>
                <div style="font-size: 8px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; color: #000;">Compliance Ratio</div>
                <div style="font-size: 13px; font-weight: 800;">
                  ${percentage}%
                  <span style="font-size: 8px; font-weight: bold; display: block; margin-top: 1px; color: #000;">
                    (${difference === 0 ? 'Exact' : (difference > 0 ? `+${percentageDiff}%` : `${percentageDiff}%`)})
                  </span>
                </div>
              </div>
            </div>

            ${approvalStatusHtml}

            <h3 style="font-size: 12px; margin-bottom: 8px; text-transform: uppercase; border-bottom: 1.5px solid #000; padding-bottom: 2px;">1. ORDER VS CAPTURED QUANTITY SUMMARY</h3>
            <table>
              <thead>
                <tr style="background-color: #eee;">
                  <th style="text-align: center; width: 30px; padding: 4px;">#</th>
                  <th style="padding: 4px;">Department</th>
                  <th style="padding: 4px;">Description</th>
                  <th style="padding: 4px;">Shade</th>
                  <th style="text-align: center; padding: 4px;">UOM</th>
                  <th style="text-align: center; padding: 4px;">PO Target (pcs)</th>
                  <th style="text-align: center; padding: 4px;">Captured Recv (pcs)</th>
                  ${isAdmin ? `
                    <th style="text-align: right; padding: 4px;">Rate</th>
                    <th style="text-align: right; padding: 4px;">Amount</th>
                  ` : ''}
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
                <tr style="font-weight: bold; background-color: #eee;">
                  <td colspan="5" style="padding: 4px 6px; font-size: 11px; font-weight: bold; text-align: right;">TOTAL QUANTITY:</td>
                  <td style="padding: 4px 6px; font-size: 11px; text-align: center; font-weight: bold;">${po.totalOrdered}</td>
                  <td style="padding: 4px 6px; font-size: 11px; text-align: center; font-weight: bold;">${po.totalReceived}</td>
                  ${isAdmin ? `
                    <td style="padding: 4px 6px; font-size: 11px; text-align: right;">—</td>
                    <td style="padding: 4px 6px; font-size: 11px; text-align: right; font-weight: bold;">${subtotal.toFixed(2)}</td>
                  ` : ''}
                </tr>
              </tbody>
            </table>

            ${isAdmin ? `
              <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                <div style="width: 200px; border: 1px solid #000; padding: 6px; border-radius: 4px; font-size: 11px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span><strong>Subtotal:</strong></span><span>${subtotal.toFixed(2)}</span></div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span><strong>GST 12%:</strong></span><span>${gst.toFixed(2)}</span></div>
                  <div style="display: flex; justify-content: space-between; font-size: 12px; border-top: 1px solid #000; padding-top: 2px; margin-top: 2px;"><span><strong>Grand Total:</strong></span><span><strong>${grandTotal.toFixed(2)}</strong></span></div>
                </div>
              </div>
            ` : ''}

            <h3 style="font-size: 12px; margin-top: 15px; margin-bottom: 8px; text-transform: uppercase; border-bottom: 1.5px solid #000; padding-bottom: 2px;">2. INWARD RECEIPTS & QUANTITY RECONCILIATION</h3>
            ${po.partialEntries && po.partialEntries.length > 0 ? `
              <table>
                <thead>
                  <tr style="background-color: #eee;">
                    <th style="padding: 5px; text-align: center;">Step #</th>
                    <th style="padding: 5px;">Date Received</th>
                    <th style="padding: 5px;">Bill / Invoice No</th>
                    <th style="padding: 5px;">Material Name</th>
                    <th style="padding: 5px; text-align: center;">PO Required Qty</th>
                    <th style="padding: 5px; text-align: center;">Received Qty</th>
                    <th style="padding: 5px; text-align: center;">Extra / Balance</th>
                    <th style="padding: 5px; text-align: center;">PO Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${po.partialEntries.map((e) => `
                    <tr style="border-bottom: 1px solid #000000;">
                      <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">#${e.stepNo}</td>
                      <td style="padding: 5px; font-size: 11px;">${e.date}</td>
                      <td style="padding: 5px; font-size: 11px; font-weight: bold;">${e.invoiceNo}</td>
                      <td style="padding: 5px; font-size: 11px; font-weight: bold;">${e.materialName}</td>
                      <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">${e.orderedQty} pcs</td>
                      <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">+${e.receivedQty} pcs</td>
                      <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">
                        ${e.extraQty > 0 ? `+${e.extraQty} pcs Extra` : (e.remainingBalance > 0 ? `${e.remainingBalance} pcs Pending` : 'Exact Match')}
                      </td>
                      <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">${e.stepStatus}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <div style="padding: 12px; border: 1.5px dashed #000000; text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 12px;">
                No inward receipts recorded yet for this PO.
              </div>
            `}

            ${signatureHtml}
            <script>window.onload = function() { window.print(); }</script>
          </body>
        </html>
      `;
    } 
    else if (po.type === 'Zip' || po.type === 'Doori') {
      const typeText = po.type.toUpperCase();
      const rowsHtml = po.items.map(item => {
        const received = po.items.length === 1 ? po.totalReceived : (po.itemizedReceived[item.name] || 0);

        const zipType = item.zipType || item.doriType || (po.type === 'Zip' ? 'BACK POCKET ZIP' : 'Dori Thread');
        const placement = item.placement || 'Main';
        const colour = item.colour || 'Black';
        const zipColour = item.zipColour || item.doriColour || 'Black';
        const price = item.price || 4.5;
        const totalCost = (item.ordered * price).toFixed(2);

        return `
          <tr style="border-bottom: 1px solid #000000;">
            <td style="padding: 5px; font-size: 11px; font-weight: bold; color: #000000;">${zipType}</td>
            <td style="padding: 5px; font-size: 11px;">${placement}</td>
            <td style="padding: 5px; font-size: 11px; text-align: center;">${colour}</td>
            <td style="padding: 5px; font-size: 11px; text-align: center;">${zipColour}</td>
            <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">${item.ordered}</td>
            <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">${received}</td>
            ${isAdmin ? `
              <td style="padding: 5px; font-size: 11px; text-align: right;">${Number(price).toFixed(2)}</td>
              <td style="padding: 5px; font-size: 11px; text-align: right; font-weight: bold;">${totalCost}</td>
            ` : ''}
          </tr>
        `;
      }).join('');

      printTemplate = `
        <html>
          <head>
            <title>${typeText} PO DETAILS - ${po.poNumber}</title>
            <style>
              body { font-family: 'Inter', sans-serif; color: #000000; margin: 0; padding: 15px; background-color: #ffffff; line-height: 1.2; }
              .header-title { text-align: center; font-size: 16px; font-weight: bold; border-bottom: 2px solid #000000; padding-bottom: 4px; margin-bottom: 12px; text-transform: uppercase; }
              .meta-table { width: 100%; border: 1px solid #000; margin-bottom: 12px; border-collapse: collapse; }
              .meta-table td { border: 1px solid #000; padding: 5px 8px; font-size: 11px; }
              table.items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1px solid #000000; }
              table.items-table th, table.items-table td { border: 1px solid #000000; padding: 5px 8px; }
              table.items-table th { font-size: 11px; text-transform: uppercase; text-align: left; font-weight: 800; background-color: #eee; }
              @media print {
                @page { size: portrait; margin: 6mm; }
                body { padding: 0; margin: 0; }
              }
            </style>
          </head>
          <body>
            <div class="header-title">${typeText} PO DETAILS (ORIGINAL)</div>
            
            <table class="meta-table">
              <tr>
                <td><strong>DATE :</strong> ${po.date}</td>
                <td><strong>ITEM :</strong> ${po.garmentType || 'SWEATSHIRT'}</td>
              </tr>
              <tr>
                <td><strong>TOTAL PCS :</strong> ${po.totalOrdered}</td>
                <td><strong>PRIORITY :</strong> ${po.priority || 'High'}</td>
              </tr>
              <tr>
                <td><strong>BRAND :</strong> ${po.brand || 'N/A'}</td>
                <td><strong>SUPERVISOR :</strong> ${po.supervisor || 'N/A'}</td>
              </tr>
              <tr>
                <td colspan="2"><strong>SUPPLIER :</strong> ${po.vendor}</td>
              </tr>
            </table>

            <div style="background-color: #ffffff; border: 1.5px solid #000000; padding: 6px 12px; border-radius: 4px; margin-bottom: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
              <div>
                <div style="font-size: 8px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; color: #000;">PO Order Qty</div>
                <div style="font-size: 13px; font-weight: 800;">${po.totalOrdered} pcs</div>
              </div>
              <div>
                <div style="font-size: 8px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; color: #000;">Total Received</div>
                <div style="font-size: 13px; font-weight: 800;">${po.totalReceived} pcs</div>
              </div>
              <div>
                <div style="font-size: 8px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; color: #000;">Receipt Difference</div>
                <div style="font-size: 13px; font-weight: 800;">
                  ${difference === 0 ? '0' : (difference > 0 ? `+${difference}` : difference)} pcs
                </div>
              </div>
              <div>
                <div style="font-size: 8px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; color: #000;">Compliance Ratio</div>
                <div style="font-size: 13px; font-weight: 800;">
                  ${percentage}%
                  <span style="font-size: 8px; font-weight: bold; display: block; margin-top: 1px; color: #000;">
                    (${difference === 0 ? 'Exact' : (difference > 0 ? `+${percentageDiff}%` : `${percentageDiff}%`)})
                  </span>
                </div>
              </div>
            </div>

            ${approvalStatusHtml}

            <table class="items-table">
              <thead>
                <tr>
                  <th>${typeText} TYPE</th>
                  <th>PLACEMENT</th>
                  <th style="text-align: center;">COLOUR</th>
                  <th style="text-align: center;">${typeText} COLOUR</th>
                  <th style="text-align: center;">QUANTITY</th>
                  <th style="text-align: center;">RECV QTY</th>
                  ${isAdmin ? `
                    <th style="text-align: right;">PRICE</th>
                    <th style="text-align: right;">TOTAL</th>
                  ` : ''}
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div style="border: 1px solid #000; padding: 6px 10px; margin-bottom: 12px; font-size: 11px;">
              <div style="font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px;">${typeText} TYPE SUMMARY</div>
              <div style="display: flex; justify-content: space-between;">
                <span>Total pieces for stitching lot:</span>
                <strong>${po.totalOrdered} pcs</strong>
              </div>
            </div>

            <h3 style="font-size: 12px; margin-bottom: 8px; text-transform: uppercase; border-bottom: 1.5px solid #000; padding-bottom: 2px;">2. INWARD RECEIPTS & QUANTITY RECONCILIATION</h3>
            ${po.partialEntries && po.partialEntries.length > 0 ? `
              <table class="items-table">
                <thead>
                  <tr style="background-color: #eee;">
                    <th style="text-align: center;">Step #</th>
                    <th>Date Received</th>
                    <th>Bill / Invoice No</th>
                    <th>Material Name</th>
                    <th style="text-align: center;">PO Required Qty</th>
                    <th style="text-align: center;">Received Qty</th>
                    <th style="text-align: center;">Extra / Balance</th>
                    <th style="text-align: center;">PO Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${po.partialEntries.map((e) => `
                    <tr>
                      <td style="text-align: center; font-weight: bold;">#${e.stepNo}</td>
                      <td>${e.date}</td>
                      <td style="font-weight: bold;">${e.invoiceNo}</td>
                      <td style="font-weight: bold;">${e.materialName}</td>
                      <td style="text-align: center; font-weight: bold;">${e.orderedQty} pcs</td>
                      <td style="text-align: center; font-weight: bold;">+${e.receivedQty} pcs</td>
                      <td style="text-align: center; font-weight: bold;">
                        ${e.extraQty > 0 ? `+${e.extraQty} pcs Extra` : (e.remainingBalance > 0 ? `${e.remainingBalance} pcs Pending` : 'Exact Match')}
                      </td>
                      <td style="text-align: center; font-weight: bold;">${e.stepStatus}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <div style="padding: 20px; border: 2px dashed #000000; text-align: center; font-size: 13px; font-weight: bold;">
                No inward receipts recorded yet for this PO.
              </div>
            `}

            ${signatureHtml}
            <script>window.onload = function() { window.print(); }</script>
          </body>
        </html>
      `;
    }
    else if (po.type === 'RGP') {
      const totalIssued = po.items.reduce((sum, item) => sum + (Number(item.ordered) || 0), 0);
      const totalBags = po.items.reduce((sum, item) => sum + (Number(item.bags) || 0), 0);
      const totalsRowHtml = `
        <tr style="background-color: #f8fafc; font-weight: bold; border-top: 1.5px solid #000000;">
          <td colSpan="6" style="padding: 5px; font-size: 11px; text-align: right; border-bottom: 1.5px solid #000000;">TOTAL QUANTITY:</td>
          <td style="padding: 5px; font-size: 11px; text-align: center; border-bottom: 1.5px solid #000000;">${totalIssued}</td>
          <td style="padding: 5px; font-size: 11px; text-align: center; border-bottom: 1.5px solid #000000;">${po.totalReceived}</td>
          <td style="padding: 5px; font-size: 11px; text-align: center; border-bottom: 1.5px solid #000000;">${totalBags}</td>
        </tr>
      `;
      const itemizedRowsHtml = po.items.map((item, idx) => {
        const received = po.items.length === 1 ? po.totalReceived : (po.itemizedReceived[item.name] || 0);

        return `
          <tr style="border-bottom: 1px solid #000000;">
            <td style="padding: 5px; font-size: 11px; text-align: center;">${idx + 1}</td>
            <td style="padding: 5px; font-size: 11px; font-weight: bold;">${item.lotNo || po.poNumber}</td>
            <td style="padding: 5px; font-size: 11px;">${item.dept || 'Stitching'}</td>
            <td style="padding: 5px; font-size: 11px; font-weight: bold; color: #000000;">${item.name}</td>
            <td style="padding: 5px; font-size: 11px;">${item.purpose || 'Stitching'}</td>
            <td style="padding: 5px; font-size: 11px; text-align: center;">${item.uom || 'PCS'}</td>
            <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">${item.ordered}</td>
            <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">${received}</td>
            <td style="padding: 5px; font-size: 11px; text-align: center;">${item.bags || '0'}</td>
          </tr>
        `;
      }).join('') + totalsRowHtml;

      printTemplate = `
        <html>
          <head>
            <title>Returnable Gate Pass Audit - ${po.poNumber}</title>
            <style>
              body { font-family: 'Inter', sans-serif; color: #000000; margin: 0; padding: 15px; background-color: #ffffff; line-height: 1.2; }
              .header-title { text-align: center; font-size: 16px; font-weight: bold; border-bottom: 2px solid #000000; padding-bottom: 4px; margin-bottom: 12px; text-transform: uppercase; }
              .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
              .border-box { border: 1px solid #000000; border-radius: 4px; padding: 8px; }
              .box-title { font-size: 10px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 2px; margin-bottom: 6px; }
              .box-row { font-size: 11px; margin-bottom: 2px; }
              .box-row strong { font-weight: bold; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1.5px solid #000000; }
              th, td { border: 1px solid #000000; padding: 5px 8px; font-size: 11px; }
              th { text-transform: uppercase; text-align: left; font-weight: 800; background-color: #eee; }
              @media print {
                @page { size: portrait; margin: 6mm; }
                body { padding: 0; margin: 0; }
              }
            </style>
          </head>
          <body>
            <div class="header-title">RETURNABLE GATE PASS (RGP) AUDIT REPORT</div>
            
            <div class="details-grid">
              <div class="border-box">
                <div class="box-title">GATE PASS DETAILS</div>
                <div class="box-row"><strong>RGP #:</strong> ${po.poNumber}</div>
                <div class="box-row"><strong>Issue Date:</strong> ${po.date}</div>
                <div class="box-row"><strong>Expected Return Date:</strong> ${po.expectedReturnDate}</div>
                <div class="box-row"><strong>Prepared By:</strong> ${po.preparedBy}</div>
                <div class="box-row"><strong>Authorized By:</strong> ${po.authorizedBy}</div>
              </div>
              
              <div class="border-box">
                <div class="box-title">SUPPLIER & TRANSPORT</div>
                <div class="box-row"><strong>Supplier Name:</strong> ${po.vendor}</div>
                <div class="box-row"><strong>Vehicle No:</strong> ${po.vehicleNo}</div>
                <div class="box-row"><strong>Remarks:</strong> ${po.remarks || 'N/A'}</div>
              </div>
            </div>

            <div style="background-color: #ffffff; border: 1.5px solid #000000; padding: 6px 12px; border-radius: 4px; margin-bottom: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
              <div>
                <div style="font-size: 8px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; color: #000;">RGP Issued Qty</div>
                <div style="font-size: 13px; font-weight: 800;">${po.totalOrdered} pcs</div>
              </div>
              <div>
                <div style="font-size: 8px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; color: #000;">Total Returned</div>
                <div style="font-size: 13px; font-weight: 800;">${po.totalReceived} pcs</div>
              </div>
              <div>
                <div style="font-size: 8px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; color: #000;">Outstanding Balance</div>
                <div style="font-size: 13px; font-weight: 800;">
                  ${po.totalOrdered - po.totalReceived} pcs
                </div>
              </div>
              <div>
                <div style="font-size: 8px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; color: #000;">Return Ratio</div>
                <div style="font-size: 13px; font-weight: 800;">
                  ${percentage}%
                </div>
              </div>
            </div>

            ${approvalStatusHtml}

            <h3 style="font-size: 14px; margin-bottom: 12px; text-transform: uppercase; border-bottom: 2px solid #000;">1. MATERIAL ISSUE VS RETURN SUMMARY</h3>
            <table>
              <thead>
                <tr>
                  <th style="text-align: center; width: 40px;">#</th>
                  <th>Lot No</th>
                  <th>Department</th>
                  <th>Description</th>
                  <th>Purpose</th>
                  <th style="text-align: center;">UOM</th>
                  <th style="text-align: center;">Issued Qty</th>
                  <th style="text-align: center;">Returned Qty</th>
                  <th style="text-align: center;">Bags</th>
                </tr>
              </thead>
              <tbody>
                ${itemizedRowsHtml}
              </tbody>
            </table>

            <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 12px; text-transform: uppercase; border-bottom: 2px solid #000;">2. INWARD RECEIPTS & QUANTITY RECONCILIATION</h3>
            ${po.partialEntries && po.partialEntries.length > 0 ? `
              <table>
                <thead>
                  <tr style="background-color: #eee;">
                    <th style="padding: 5px; text-align: center;">Step #</th>
                    <th style="padding: 5px;">Date Received</th>
                    <th style="padding: 5px;">Bill / Invoice No</th>
                    <th style="padding: 5px;">Material Name</th>
                    <th style="padding: 5px; text-align: center;">PO Required Qty</th>
                    <th style="padding: 5px; text-align: center;">Received Qty</th>
                    <th style="padding: 5px; text-align: center;">Extra / Balance</th>
                    <th style="padding: 5px; text-align: center;">PO Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${po.partialEntries.map((e) => `
                    <tr style="border-bottom: 1px solid #000000;">
                      <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">#${e.stepNo}</td>
                      <td style="padding: 5px; font-size: 11px;">${e.date}</td>
                      <td style="padding: 5px; font-size: 11px; font-weight: bold;">${e.invoiceNo}</td>
                      <td style="padding: 5px; font-size: 11px; font-weight: bold;">${e.materialName}</td>
                      <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">${e.orderedQty} pcs</td>
                      <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">+${e.receivedQty} pcs</td>
                      <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">
                        ${e.extraQty > 0 ? `+${e.extraQty} pcs Extra` : (e.remainingBalance > 0 ? `${e.remainingBalance} pcs Pending` : 'Exact Match')}
                      </td>
                      <td style="padding: 5px; font-size: 11px; text-align: center; font-weight: bold;">${e.stepStatus}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <div style="padding: 20px; border: 2px dashed #000000; text-align: center; font-size: 13px; font-weight: bold;">
                No inward receipts recorded yet for this RGP.
              </div>
            `}

            ${rgpSignatureHtml}
            <script>window.onload = function() { window.print(); }</script>
          </body>
        </html>
      `;
    } 
    else {
      printTemplate = `
        <html>
          <head>
            <title>Verification Report - ${po.poNumber}</title>
            <style>
              body { font-family: 'Inter', sans-serif; padding: 40px; color: #000; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { border-bottom: 2px solid #000; text-align: left; padding: 8px; }
              td { border-bottom: 1px solid #ccc; padding: 8px; }
            </style>
          </head>
          <body>
            <h2>VERIFICATION AUDIT FOR CUSTOM PO: ${po.poNumber}</h2>
            <p><strong>Supplier:</strong> ${po.vendor}</p>
            <p><strong>Date:</strong> ${po.date}</p>
            <p><strong>Total Ordered:</strong> ${po.totalOrdered} pcs</p>
            <p><strong>Total Received:</strong> ${po.totalReceived} pcs</p>
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Order target</th>
                  <th>Received</th>
                  <th>Difference</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Trim shipment</td>
                  <td>${po.totalOrdered}</td>
                  <td>${po.totalReceived}</td>
                  <td>${difference} (${percentageDiff}%)</td>
                </tr>
              </tbody>
            </table>
            ${approvalStatusHtml}
            ${signatureHtml}
            <script>window.print();</script>
          </body>
        </html>
      `;
    }

    printWindow.document.write(printTemplate);
    printWindow.document.close();
  };

  const handleDownloadVerificationPDF = (po) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const isPendingApp = po.hasPendingApproval;
      const isCompleted = !isPendingApp && (po.poStatus === 'Completed' || po.verificationStatus === 'Matched' || (po.totalOrdered > 0 && po.approvedReceived >= po.totalOrdered));
      const pendingQty = Math.max(0, po.totalOrdered - (po.approvedReceived || 0));

      // ─── Outer Page Border ───
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1.2);
      doc.rect(24, 24, 547.28, 794);

      // ─── Header Top Bar (Black & White with Border) ───
      doc.setFillColor(245, 245, 245);
      doc.rect(24, 24, 547.28, 42, 'FD');

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('G-PDMS | PURCHASE ORDER AUDIT & INWARD VERIFICATION', 36, 50);

      // ─── Metadata Section in Bordered Box ───
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.8);
      doc.rect(36, 78, 523, 58);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`PO Reference: ${po.poNumber}`, 46, 96);
      doc.text(`Vendor / Supplier: ${po.vendor || 'Direct Vendor'}`, 46, 111);
      doc.text(`Issued Date: ${po.date || 'N/A'}`, 46, 126);

      doc.text(`PO Type: ${po.type || 'General'}`, 330, 96);
      doc.text(`Total Ordered: ${po.totalOrdered} pcs`, 330, 111);
      doc.text(`Total Received: ${po.totalReceived} pcs`, 330, 126);

      // ─── Status Box (Black & White with Border) ───
      let statusSummary = 'STATUS: PENDING INWARD';
      if (isPendingApp) {
        statusSummary = `STATUS: PENDING APPROVAL (${po.pendingApprovalPieces || 0} PCS HELD)`;
      } else if (isCompleted) {
        statusSummary = 'STATUS: COMPLETED & VERIFIED (IN STOCK)';
      } else if (po.totalReceived > 0) {
        statusSummary = `STATUS: PARTIAL (${pendingQty} PCS SHORT / PENDING)`;
      }

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1);
      doc.rect(36, 142, 523, 20, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(statusSummary, 46, 155);

      const balanceText = `Pending Balance: ${pendingQty > 0 ? `${pendingQty} pcs` : '0 pcs (Fulfilled)'}`;
      doc.setFont('helvetica', 'normal');
      doc.text(balanceText, 380, 155);

      let currentY = 178;

      // ─── Section 1: Ordered Items vs Received ───
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('1. ORDERED ITEMS SPECIFICATIONS & COMPLIANCE', 36, currentY);

      const itemsHead = [['#', 'Item / Description', 'Dept', 'Ordered (pcs)', 'Received (pcs)', 'Status / Variance']];
      const itemsBody = (po.items && po.items.length > 0)
        ? po.items.map((itm, i) => {
            const recv = po.items.length === 1 ? po.totalReceived : (po.itemizedReceived[itm.name] || 0);
            const bal = Math.max(0, itm.ordered - recv);
            return [
              i + 1,
              itm.name || 'Trim Item',
              itm.dept || itm.department || 'Trims',
              itm.ordered,
              recv,
              bal > 0 ? `${bal} pcs short` : 'Fulfilled'
            ];
          })
        : [[1, 'Standard Trim order', 'Trims', po.totalOrdered, po.totalReceived, isCompleted ? 'Fulfilled' : `${pendingQty} pcs short`]];

      autoTable(doc, {
        head: itemsHead,
        body: itemsBody,
        startY: currentY + 6,
        theme: 'grid',
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8.5,
          lineColor: [0, 0, 0],
          lineWidth: 0.8
        },
        bodyStyles: {
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.8
        },
        styles: {
          fontSize: 8,
          cellPadding: 4,
          lineColor: [0, 0, 0],
          lineWidth: 0.8,
          textColor: [0, 0, 0]
        },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' },
          1: { cellWidth: 220 },
          2: { cellWidth: 65 },
          3: { cellWidth: 65, halign: 'center' },
          4: { cellWidth: 65, halign: 'center' },
          5: { cellWidth: 78, halign: 'center' }
        }
      });

      currentY = doc.lastAutoTable.finalY + 18;

      // ─── Section 2: Sequential Partial Inward Receipts ───
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('2. SEQUENTIAL INWARD RECEIPTS RECORD & RECONCILIATION', 36, currentY);

      const inwardHead = [['Step #', 'Date Received', 'Bill / Invoice No', 'Material Name', 'PO Required Qty', 'Received Qty', 'Extra / Balance', 'PO Status']];
      const inwardBody = (po.partialEntries && po.partialEntries.length > 0)
        ? po.partialEntries.map((e) => [
            `#${e.stepNo}`,
            e.date,
            e.invoiceNo,
            e.materialName,
            `${e.orderedQty} pcs`,
            `+${e.receivedQty} pcs`,
            e.extraQty > 0 ? `+${e.extraQty} Extra` : (e.remainingBalance > 0 ? `${e.remainingBalance} Pending` : 'Exact Match'),
            e.stepStatus
          ])
        : [['-', 'N/A', 'N/A', 'No inward receipts recorded yet', `${po.totalOrdered} pcs`, '0', `${po.totalOrdered} pcs Pending`, 'Pending']];

      autoTable(doc, {
        head: inwardHead,
        body: inwardBody,
        startY: currentY + 6,
        theme: 'grid',
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 8,
          lineColor: [0, 0, 0],
          lineWidth: 0.8
        },
        bodyStyles: {
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.8
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 4,
          lineColor: [0, 0, 0],
          lineWidth: 0.8,
          textColor: [0, 0, 0]
        },
        columnStyles: {
          0: { cellWidth: 35, halign: 'center' },
          1: { cellWidth: 75 },
          2: { cellWidth: 70, fontStyle: 'bold' },
          3: { cellWidth: 95 },
          4: { cellWidth: 60, halign: 'center' },
          5: { cellWidth: 55, halign: 'center' },
          6: { cellWidth: 70, halign: 'center' },
          7: { cellWidth: 58, halign: 'center' }
        }
      });

      // ─── Signatures Block (Anchored at Page Bottom) ───
      let lastTableY = doc.lastAutoTable.finalY;
      if (lastTableY > 720) {
        doc.addPage();
        // Add outer border on new page
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(1.2);
        doc.rect(24, 24, 547.28, 794);
      }

      const sigLineY = 765;
      const sigTextY = 778;

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1);
      doc.line(36, sigLineY, 175, sigLineY);
      doc.line(215, sigLineY, 355, sigLineY);
      doc.line(395, sigLineY, 545, sigLineY);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Store In-Charge Signature', 40, sigTextY);
      doc.text('Audited & Verified By', 230, sigTextY);
      doc.text('Authorized Signatory', 420, sigTextY);

      // Footer timestamp inside frame
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 90, 90);
      doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, 36, 804);
      doc.text('Official Inward Verification Document', 418, 804);

      // Save PDF file directly to client
      doc.save(`PO_Verification_${po.poNumber || 'Report'}.pdf`);
      showToast('Success', `Downloaded PDF for ${po.poNumber}!`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToast('Error', 'Failed to generate PDF download: ' + err.message, 'error');
    }
  };

  const handleApproveEntry = async (entry) => {
    if (!window.confirm(`Approve excess inward receipt #${entry.stepNo} (+${entry.receivedQty} pcs of ${entry.materialName}) and finalize into active warehouse inventory?`)) return;
    try {
      setApprovingId(entry.id);
      const res = await fetch(`${getBackendUrl()}/api/inward/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          approvedBy: currentUser?.name || 'Manager',
          note: 'Approved via PO Verification'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Success', `✅ Inward receipt #${entry.stepNo} approved and finalized into inventory!`);
        await fetchData();
      } else {
        showToast('Error', 'Approval failed: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      showToast('Error', 'Error approving receipt: ' + err.message, 'error');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectEntry = async (entry) => {
    const reason = window.prompt(`Enter reason for rejecting excess inward receipt #${entry.stepNo}:`, 'Excess quantity not authorized - return to vendor');
    if (reason === null) return;
    try {
      setRejectingId(entry.id);
      const res = await fetch(`${getBackendUrl()}/api/inward/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          rejectedBy: currentUser?.name || 'Manager',
          reason: reason || 'Rejected due to excess quantity'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Success', `❌ Inward receipt #${entry.stepNo} rejected and excluded from inventory.`);
        await fetchData();
      } else {
        showToast('Error', 'Rejection failed: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      showToast('Error', 'Error rejecting receipt: ' + err.message, 'error');
    } finally {
      setRejectingId(null);
    }
  };

  const handlePrintSingleReceipt = (po, entry) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Error', 'Popup blocker is preventing receipt printing.', 'error');
      return;
    }

    const receiptHtml = `
      <html>
        <head>
          <title>Material Inward Receipt - Step #${entry.stepNo} (${entry.invoiceNo})</title>
          <style>
            body { font-family: 'Inter', sans-serif; color: #000000; margin: 0; padding: 20px; background-color: #ffffff; line-height: 1.3; }
            .receipt-card { max-width: 650px; margin: 0 auto; border: 2px solid #000000; border-radius: 8px; padding: 20px; }
            .header-title { text-align: center; font-size: 16px; font-weight: 900; border-bottom: 2px solid #000000; padding-bottom: 6px; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 1px; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
            .border-box { border: 1px solid #000000; border-radius: 4px; padding: 8px 10px; }
            .box-title { font-size: 10px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 2px; margin-bottom: 4px; }
            .box-row { font-size: 11.5px; margin-bottom: 3px; }
            .status-banner { border: 1.5px solid #000000; background-color: #f3f4f6; padding: 8px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; text-align: center; margin-bottom: 14px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1.5px solid #000000; }
            th, td { border: 1px solid #000000; padding: 6px 8px; font-size: 11px; }
            th { text-transform: uppercase; text-align: left; font-weight: 800; background-color: #eee; }
            .signatures { margin-top: 35px; display: flex; justify-content: space-between; align-items: flex-start; font-size: 11px; gap: 20px; }
            .sig-box { text-align: center; flex: 1; }
            .sig-line { border-top: 1.5px solid #000000; padding-top: 5px; font-weight: bold; margin-top: 30px; }
            @media print {
              @page { size: portrait; margin: 8mm; }
              body { padding: 0; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            <div class="header-title">MATERIAL INWARD RECEIPT SLIP</div>
            
            <div class="details-grid">
              <div class="border-box">
                <div class="box-title">PO & VENDOR DETAILS</div>
                <div class="box-row"><strong>PO Number:</strong> ${po.poNumber}</div>
                <div class="box-row"><strong>Supplier / Vendor:</strong> ${po.vendor}</div>
                <div class="box-row"><strong>PO Issue Date:</strong> ${po.date}</div>
              </div>
              <div class="border-box">
                <div class="box-title">INWARD RECEIPT INFORMATION</div>
                <div class="box-row"><strong>Receipt Step:</strong> Step #${entry.stepNo} of ${po.partialEntries?.length || 1}</div>
                <div class="box-row"><strong>Date Received:</strong> ${entry.date}</div>
                <div class="box-row"><strong>Bill / Invoice No:</strong> ${entry.invoiceNo}</div>
              </div>
            </div>

            <div class="status-banner" style="background-color: ${entry.approvalStatus === 'Approved' ? '#ecfdf5' : (entry.approvalStatus === 'Rejected' ? '#fef2f2' : '#fffbeb')}; border-color: ${entry.approvalStatus === 'Approved' ? '#10b981' : (entry.approvalStatus === 'Rejected' ? '#f43e5c' : '#f59e0b')}; color: ${entry.approvalStatus === 'Approved' ? '#065f46' : (entry.approvalStatus === 'Rejected' ? '#991b1b' : '#92400e')};">
              ${entry.approvalStatus === 'Approved' ? '✔ STATUS: APPROVED & FINALIZED INTO INVENTORY' : (entry.approvalStatus === 'Rejected' ? '✖ STATUS: REJECTED - RETURN TO SUPPLIER (NOT IN STOCK)' : '⏳ STATUS: PENDING MANAGER APPROVAL (EXCESS INWARD - NOT STORED)')}
            </div>

            <table>
              <thead>
                <tr>
                  <th style="text-align: center;">Step #</th>
                  <th>Date Received</th>
                  <th>Bill / Invoice No</th>
                  <th>Material Name</th>
                  <th style="text-align: center;">PO Required Qty</th>
                  <th style="text-align: center;">Received Qty</th>
                  <th style="text-align: center;">Extra / Balance</th>
                  <th style="text-align: center;">PO Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="text-align: center; font-weight: bold;">#${entry.stepNo}</td>
                  <td>${entry.date}</td>
                  <td style="font-weight: bold;">${entry.invoiceNo}</td>
                  <td style="font-weight: bold;">${entry.materialName}</td>
                  <td style="text-align: center; font-weight: bold;">${entry.orderedQty} pcs</td>
                  <td style="text-align: center; font-weight: bold;">+${entry.receivedQty} pcs</td>
                  <td style="text-align: center; font-weight: bold;">
                    ${entry.extraQty > 0 ? `+${entry.extraQty} pcs Extra` : (entry.remainingBalance > 0 ? `${entry.remainingBalance} pcs Pending` : 'Exact Match')}
                  </td>
                  <td style="text-align: center; font-weight: bold;">${entry.stepStatus}</td>
                </tr>
              </tbody>
            </table>

            <div style="border: 1px solid #000000; border-radius: 4px; padding: 8px 10px; font-size: 11px; margin-bottom: 14px; background: #fafafa;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                <span><strong>Storage Rack Location:</strong> ${entry.location || 'Main Store'}</span>
                <span><strong>Store In-Charge / Operator:</strong> ${entry.operator || 'Store Team'}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span><strong>Progressive Total Received:</strong> ${entry.cumulativeReceived} pcs</span>
                <span><strong>Outstanding Balance to Deliver:</strong> ${entry.remainingBalance > 0 ? `${entry.remainingBalance} pcs` : '0 pcs'}</span>
              </div>
            </div>

            <div class="signatures">
              <div class="sig-box">
                <div class="sig-line">Store In-Charge Signature</div>
              </div>
              <div class="sig-box">
                <div class="sig-line">Weighbridge Operator</div>
              </div>
              <div class="sig-box">
                <div class="sig-line">Security / Gate Officer</div>
              </div>
            </div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  const handleDownloadSingleReceiptPDF = (po, entry) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      
      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 595, 60, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('MATERIAL INWARD RECEIPT SLIP', 36, 32);
      
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Receipt Step #${entry.stepNo} • Bill/Inv: ${entry.invoiceNo}`, 36, 48);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`PO: ${po.poNumber}`, 559, 36, { align: 'right' });

      // Metadata card
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(36, 75, 523, 60, 4, 4, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('SUPPLIER / VENDOR', 48, 92);
      doc.text('DATE RECEIVED', 230, 92);
      doc.text('PO REQUIRED QTY', 360, 92);
      doc.text('RECEIVED THIS INWARD', 460, 92);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(po.vendor || 'N/A'), 48, 107);
      doc.text(String(entry.date || 'N/A'), 230, 107);
      doc.text(`${entry.orderedQty} pcs`, 360, 107);
      doc.setTextColor(30, 58, 138);
      doc.text(`+${entry.receivedQty} pcs`, 460, 107);

      // Status pill
      const isApproved = entry.approvalStatus === 'Approved';
      const isRejected = entry.approvalStatus === 'Rejected';
      const isPending = entry.approvalStatus === 'Pending Approval';
      
      const pillText = isApproved ? 'STATUS: APPROVED & FINALIZED IN STOCK' : (isRejected ? 'STATUS: REJECTED - RETURN TO SUPPLIER' : 'STATUS: AWAITING MANAGER APPROVAL (EXCESS)');
      const pillBg = isApproved ? [16, 185, 129] : (isRejected ? [244, 62, 92] : [245, 158, 11]);

      doc.setFillColor(pillBg[0], pillBg[1], pillBg[2]);
      doc.roundedRect(36, 145, 250, 18, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(pillText, 44, 157);

      // Receipt Table
      const receiptHead = [['Step #', 'Date Received', 'Bill / Invoice No', 'Material Name', 'PO Required Qty', 'Received Qty', 'Extra / Balance', 'PO Status']];
      const receiptBody = [[
        `#${entry.stepNo}`,
        entry.date,
        entry.invoiceNo,
        entry.materialName,
        `${entry.orderedQty} pcs`,
        `+${entry.receivedQty} pcs`,
        entry.extraQty > 0 ? `+${entry.extraQty} Extra` : (entry.remainingBalance > 0 ? `${entry.remainingBalance} Pending` : 'Exact Match'),
        entry.stepStatus
      ]];

      autoTable(doc, {
        head: receiptHead,
        body: receiptBody,
        startY: 175,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 5 },
        columnStyles: {
          0: { cellWidth: 35, halign: 'center' },
          1: { cellWidth: 75 },
          2: { cellWidth: 70, fontStyle: 'bold' },
          3: { cellWidth: 95 },
          4: { cellWidth: 60, halign: 'center' },
          5: { cellWidth: 55, halign: 'center' },
          6: { cellWidth: 70, halign: 'center' },
          7: { cellWidth: 60, halign: 'center' }
        }
      });

      let currentY = doc.lastAutoTable.finalY + 18;

      // Summary block
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(36, currentY, 523, 40, 4, 4, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text(`Location: ${entry.location || 'Main Store'}    |    Store In-Charge: ${entry.operator || 'Store Team'}`, 48, currentY + 16);
      doc.text(`Progressive Received: ${entry.cumulativeReceived} pcs    |    Remaining Balance: ${entry.remainingBalance > 0 ? `${entry.remainingBalance} pcs` : '0 pcs (Complete)'}`, 48, currentY + 30);

      currentY += 75;

      // Signatures
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.8);
      doc.line(36, currentY + 25, 170, currentY + 25);
      doc.line(210, currentY + 25, 350, currentY + 25);
      doc.line(390, currentY + 25, 540, currentY + 25);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('Store In-Charge Signature', 40, currentY + 37);
      doc.text('Weighbridge Operator', 230, currentY + 37);
      doc.text('Security / Gate Signatory', 410, currentY + 37);

      doc.save(`Receipt_Step${entry.stepNo}_${po.poNumber}_${entry.invoiceNo}.pdf`);
      showToast('Success', `Downloaded PDF for Receipt #${entry.stepNo}!`);
    } catch (err) {
      console.error('Error downloading single receipt PDF:', err);
      showToast('Error', 'Failed to generate PDF: ' + err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--bg-primary, #ffffff)',
            border: `1.5px solid ${toast.type === 'success' ? '#10b981' : '#f43e5c'}`,
            borderRadius: 'var(--border-radius-md, 12px)',
            padding: '12px 20px',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={24} style={{ color: '#10b981', flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={24} style={{ color: '#f43e5c', flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontWeight: '700', color: toast.type === 'success' ? '#10b981' : '#f43e5c', fontSize: '14px' }}>{toast.title}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-main, #1e293b)' }}>{toast.message}</div>
          </div>
        </div>
      )}

      {/* Title block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-family-title)' }}>PO Receipts Verification System</h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Match ordered items against weighbridge-captured receipt logs under the same PO Number
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          Refresh Data
        </button>
      </div>

      {/* Dashboard cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        
        <div className="panel" style={{ padding: '16px', borderLeft: '4px solid var(--accent-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tracked POs</span>
            <FileText size={18} style={{ color: 'var(--accent-color)' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 2px 0', color: 'var(--text-main)' }}>{stats.total}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Registered PO documents</div>
        </div>

        <div className="panel" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fully Verified</span>
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 2px 0', color: '#10b981' }}>{stats.matched}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Receipts match PO perfectly</div>
        </div>

        <div className="panel" style={{ padding: '16px', borderLeft: '4px solid #f43e5c' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Shortages</span>
            <TrendingDown size={18} style={{ color: '#f43e5c' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 2px 0', color: '#f43e5c' }}>{stats.shortages}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Under-received discrepancies</div>
        </div>

        <div className="panel" style={{ padding: '16px', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Excess / Overages</span>
            <TrendingUp size={18} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 2px 0', color: '#8b5cf6' }}>{stats.excess}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Over-received PO shipments</div>
        </div>

        <div className="panel" style={{ padding: '16px', borderLeft: '4px solid #64748b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending Receipts</span>
            <Clock size={18} style={{ color: '#64748b' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0 2px 0', color: '#64748b' }}>{stats.pending}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>0 pieces received so far</div>
        </div>

      </div>

      {/* Excess Inward Awaiting Approval Banner */}
      {unifiedPOs.some(p => p.hasPendingApproval) && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '2px solid #f59e0b',
          borderRadius: 'var(--border-radius-md)',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={24} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#92400e' }}>
                ⚠️ Excess Material Inward Awaiting Authorization
              </div>
              <div style={{ fontSize: '12.5px', color: '#78350f', marginTop: '2px' }}>
                One or more inward receipts exceeded the PO ordered quantity. Without manager approval, excess material is <strong>held and not added to inventory stock</strong>.
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const pendingPo = unifiedPOs.find(p => p.hasPendingApproval);
              if (pendingPo) setSelectedPO(pendingPo);
            }}
            style={{ backgroundColor: '#d97706', borderColor: '#d97706', whiteSpace: 'nowrap', fontWeight: 'bold' }}
          >
            {isAdmin ? 'Review & Authorize' : 'View Pending POs'}
          </button>
        </div>
      )}

      {/* Main Panel Search + Listing Grid */}
      <div className="panel" style={{ padding: '20px' }}>
        
        {/* Search controls */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="form-group" style={{ flex: '1 1 250px', marginBottom: 0 }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Search size={16} />
              </span>
              <input
                type="text"
                className="form-input"
                placeholder="Search PO Number, Vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '38px', height: '40px' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ flex: '0 1 180px', marginBottom: 0 }}>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ height: '40px', cursor: 'pointer' }}
            >
              <option value="all">🔍 All Statuses</option>
              <option value="accepted">🟢 Accepted</option>
              <option value="pending_approval">⏳ Pending Approval</option>
              <option value="rejected">🔴 Rejected</option>
              <option value="pending">📄 Pending Inward</option>
              <option value="shortage">⚠️ Shortages</option>
              <option value="excess">🟣 Excess</option>
            </select>
          </div>

          <div className="form-group" style={{ flex: '0 1 180px', marginBottom: 0 }}>
            <select
              className="form-input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ height: '40px', cursor: 'pointer' }}
            >
              <option value="all">📦 All Types</option>
              <option value="general">📄 General PO</option>
              <option value="rgp">🚚 RGP (Gate Pass)</option>
              <option value="unregistered po">⚠️ Unregistered PO</option>
            </select>
          </div>

          <div className="form-group" style={{ flex: '0 1 180px', marginBottom: 0 }}>
            <select
              className="form-input"
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              style={{ height: '40px', cursor: 'pointer' }}
            >
              <option value="all">🧵 All Materials</option>
              {uniqueMaterials.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
            <button
              onClick={() => setActiveViewTab('report')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeViewTab === 'report' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: activeViewTab === 'report' ? '#fff' : 'var(--text-main)',
                fontSize: '12.5px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              All PO Records
            </button>
            <button
              onClick={() => setActiveViewTab('accepted')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeViewTab === 'accepted' ? '#10b981' : 'var(--bg-secondary)',
                color: activeViewTab === 'accepted' ? '#fff' : 'var(--text-main)',
                fontSize: '12.5px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CheckCircle2 size={14} />
              <span>Accepted Orders ({acceptedOrders.length})</span>
            </button>
            <button
              onClick={() => setActiveViewTab('timeline')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeViewTab === 'timeline' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: activeViewTab === 'timeline' ? '#fff' : 'var(--text-main)',
                fontSize: '12.5px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Live Receipt Feed
            </button>
          </div>
        </div>

        {/* View switching */}
        {activeViewTab === 'report' ? (
          <div className="table-responsive" style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1.5px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 12px', fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '130px', whiteSpace: 'nowrap' }}>PO Number</th>
                  <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '110px', whiteSpace: 'nowrap' }}>Type</th>
                  <th style={{ padding: '12px 12px', fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '140px' }}>Supplier / Vendor</th>
                  <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', minWidth: '95px', whiteSpace: 'nowrap' }}>Ordered</th>
                  <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', minWidth: '120px', whiteSpace: 'nowrap' }}>Received</th>
                  <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', minWidth: '120px', whiteSpace: 'nowrap' }}>Balance / Extra</th>
                  <th style={{ padding: '12px 12px', fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '240px' }}>Inward Receipts (Bill & Date)</th>
                  <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', minWidth: '130px', whiteSpace: 'nowrap' }}>PO Status</th>
                  <th style={{ padding: '12px 12px', fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', minWidth: '140px', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
                      <span>Verifying PO database records...</span>
                    </td>
                  </tr>
                ) : displayPOs.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      <HelpCircle size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4, color: 'var(--text-muted)' }} />
                      <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>No matching purchase orders found</div>
                      <div style={{ fontSize: '12px', marginTop: '2px' }}>No records match the current filters or search term.</div>
                    </td>
                  </tr>
                ) : (
                  paginatedAllPOs.map((po) => {
                    const isPendingApp = po.hasPendingApproval;
                    const hasRejected = po.hasRejected || (po.rejectedCount > 0 && (po.approvedReceived || 0) === 0 && !isPendingApp);
                    const isCompleted = !isPendingApp && !hasRejected && (po.poStatus === 'Accepted' || po.poStatus === 'Completed' || po.verificationStatus === 'Matched' || (po.totalOrdered > 0 && po.approvedReceived >= po.totalOrdered));
                    const isPartial = !isCompleted && !isPendingApp && !hasRejected && (po.approvedReceived || 0) > 0;
                    const pendingQty = Math.max(0, po.totalOrdered - (po.approvedReceived || 0));

                    let statusColor = 'var(--accent-color)';
                    let statusBg = 'var(--accent-light)';
                    let statusBorder = 'rgba(99, 102, 241, 0.25)';
                    let statusLabel = 'Pending Inward';

                    if (isPendingApp) {
                      statusColor = '#b45309';
                      statusBg = '#fef3c7';
                      statusBorder = '#fde68a';
                      statusLabel = 'Pending Approval';
                    } else if (hasRejected) {
                      statusColor = '#dc2626';
                      statusBg = '#fee2e2';
                      statusBorder = '#fecdd3';
                      statusLabel = 'Rejected';
                    } else if (isCompleted) {
                      statusColor = '#059669';
                      statusBg = '#ecfdf5';
                      statusBorder = '#a7f3d0';
                      statusLabel = 'Accepted';
                    } else if (isPartial) {
                      statusColor = '#d97706';
                      statusBg = '#fffbeb';
                      statusBorder = '#fde68a';
                      statusLabel = `Pending (Partial ${po.partialEntries?.length || 1})`;
                    }

                    return (
                      <tr
                        key={po.poNumber}
                        style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                        className="hover-row"
                        onClick={() => setSelectedPO(po)}
                      >
                        {/* PO Number & Date */}
                        <td style={{ padding: '12px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '13px', color: 'var(--accent-color)' }}>
                            {po.poNumber}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '500' }}>
                            {po.date || 'N/A'}
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td style={{ padding: '12px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                            whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px',
                            backgroundColor: po.type === 'Zip' ? '#eff6ff' : (po.type === 'Doori' ? '#fffbeb' : (po.type === 'General' ? '#f0fdf4' : '#fff1f2')),
                            color: po.type === 'Zip' ? '#1d4ed8' : (po.type === 'Doori' ? '#b45309' : (po.type === 'General' ? '#15803d' : '#e11d48')),
                            border: `1px solid ${po.type === 'Zip' ? '#bfdbfe' : (po.type === 'Doori' ? '#fde68a' : (po.type === 'General' ? '#bbf7d0' : '#fecdd3'))}`
                          }}>
                            {po.type === 'Unregistered PO' ? '⚠️ Unregistered' : po.type}
                          </span>
                        </td>

                        {/* Vendor Name */}
                        <td style={{ padding: '12px 12px', verticalAlign: 'middle', minWidth: '140px', maxWidth: '180px' }}>
                          <div style={{ fontWeight: '600', fontSize: '12.5px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={po.vendor}>
                            {po.vendor && po.vendor !== 'N/A' && po.vendor.trim() ? po.vendor : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 'normal' }}>Direct Vendor</span>}
                          </div>
                        </td>

                        {/* Ordered Qty */}
                        <td style={{ padding: '12px 10px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {po.totalOrdered > 0 ? (
                            <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>
                              {po.totalOrdered.toLocaleString()} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>pcs</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '500' }}>—</span>
                          )}
                        </td>

                        {/* Received Qty */}
                        <td style={{ padding: '12px 10px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: '13.5px', fontWeight: '800', color: isCompleted ? '#059669' : (hasRejected ? '#dc2626' : (isPendingApp ? '#d97706' : 'var(--text-main)')) }}>
                            {(po.approvedReceived || 0).toLocaleString()} <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>pcs</span>
                          </div>
                          {isPendingApp && po.pendingApprovalPieces > 0 ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#b45309', fontWeight: '700', marginTop: '2px', backgroundColor: '#fef3c7', padding: '1px 6px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                              ⚠️ ({po.pendingApprovalPieces.toLocaleString()} pcs Pending)
                            </div>
                          ) : hasRejected && po.rejectedPieces > 0 ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#dc2626', fontWeight: '700', marginTop: '2px', backgroundColor: '#fee2e2', padding: '1px 6px', borderRadius: '4px', border: '1px solid #fecdd3' }}>
                              ✖ ({po.rejectedPieces.toLocaleString()} pcs Rejected)
                            </div>
                          ) : po.approvedReceived > 0 ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#059669', fontWeight: '700', marginTop: '2px', backgroundColor: '#ecfdf5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                              ✓ ({po.approvedReceived.toLocaleString()} pcs In Stock)
                            </div>
                          ) : null}
                        </td>

                        {/* Balance / Extra */}
                        <td style={{ padding: '12px 10px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {hasRejected && (po.approvedReceived || 0) === 0 ? (
                            <span style={{ color: '#dc2626', backgroundColor: '#fee2e2', border: '1px solid #fecdd3', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                              Rejected
                            </span>
                          ) : isPendingApp ? (
                            <span style={{ color: '#b45309', backgroundColor: '#fef3c7', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                              Awaiting Approval
                            </span>
                          ) : po.extraBalance > 0 ? (
                            <span style={{ color: '#7c3aed', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                              +{po.extraBalance.toLocaleString()} Extra
                            </span>
                          ) : pendingQty > 0 ? (
                            <span style={{ color: '#e11d48', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                              {pendingQty.toLocaleString()} Pending
                            </span>
                          ) : (
                            <span style={{ color: '#059669', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                              0 (Fulfilled)
                            </span>
                          )}
                        </td>

                        {/* Inward Receipts */}
                        <td style={{ padding: '12px 12px', verticalAlign: 'middle', fontSize: '11.5px' }}>
                          {po.partialEntries && po.partialEntries.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '380px' }}>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>📦 {po.partialEntries.length} Inward Receipt{po.partialEntries.length > 1 ? 's' : ''}:</span>
                              </div>
                              {po.partialEntries.slice(0, 2).map((e, idx) => {
                                const isApp = e.approvalStatus === 'Approved';
                                const isRej = e.approvalStatus === 'Rejected';
                                const isPend = e.approvalStatus === 'Pending Approval';
                                const isManual = e.entryMode === 'Manually' || e.entryMode === 'Manual';
                                const dateFormatted = e.date ? e.date.split(' ')[0] : 'N/A';

                                return (
                                  <div key={idx} style={{
                                    display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', fontSize: '11px',
                                    background: 'var(--bg-secondary)', padding: '3px 7px', borderRadius: '6px', border: '1px solid var(--border-color)'
                                  }}>
                                    <span style={{
                                      padding: '1px 5px', borderRadius: '4px', fontSize: '9.5px', fontWeight: '800',
                                      background: isManual ? '#eff6ff' : '#f0fdf4',
                                      color: isManual ? '#2563eb' : '#059669',
                                      border: `1px solid ${isManual ? '#bfdbfe' : '#bbf7d0'}`
                                    }}>
                                      {isManual ? '📝 Manual' : '⚖️ Scale'}
                                    </span>

                                    <span style={{ fontFamily: 'monospace', fontWeight: '800', color: 'var(--text-main)' }}>
                                      {e.invoiceNo}
                                    </span>

                                    <span style={{ color: isRej ? '#dc2626' : '#2563eb', fontWeight: '700' }}>
                                      +{e.receivedQty.toLocaleString()} {e.unit || 'Pcs'}
                                    </span>

                                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                      ({!isManual && e.netWeightKg > 0 ? `${e.netWeightKg} kg • ` : ''}{e.packets || 1} pkt{e.packets > 1 ? 's' : ''})
                                    </span>

                                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                      • {dateFormatted}
                                    </span>

                                    {isApp && (
                                      <span style={{ padding: '1px 4px', borderRadius: '3px', fontSize: '9px', fontWeight: '800', background: '#d1fae5', color: '#065f46' }}>
                                        Accepted
                                      </span>
                                    )}
                                    {isPend && (
                                      <span style={{ padding: '1px 4px', borderRadius: '3px', fontSize: '9px', fontWeight: '800', background: '#fef3c7', color: '#92400e' }}>
                                        Pending
                                      </span>
                                    )}
                                    {isRej && (
                                      <span style={{ padding: '1px 4px', borderRadius: '3px', fontSize: '9px', fontWeight: '800', background: '#fee2e2', color: '#991b1b' }}>
                                        Rejected
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {po.partialEntries.length > 2 && (
                                <span style={{ fontSize: '10.5px', color: 'var(--accent-color)', fontWeight: '600', paddingLeft: '2px' }}>
                                  +{po.partialEntries.length - 2} more receipt{po.partialEntries.length - 2 > 1 ? 's' : ''} (click Details)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11.5px', fontStyle: 'italic' }}>Waiting for 1st Inward</span>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 10px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                            <span style={{
                              padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800',
                              color: statusColor, backgroundColor: statusBg, border: `1px solid ${statusBorder}`,
                              textTransform: 'uppercase', letterSpacing: '0.04em', display: 'inline-block'
                            }}>
                              {statusLabel}
                            </span>
                            {po.hasPendingApproval && (
                              <span style={{
                                padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800',
                                color: '#92400e', backgroundColor: '#fef3c7', border: '1px solid #f59e0b',
                                display: 'inline-flex', alignItems: 'center', gap: '3px'
                              }}>
                                ⚠️ {po.pendingApprovalCount} Needs Approval
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 12px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => setSelectedPO(po)}
                              style={{ padding: '4px 9px', fontSize: '11px', fontWeight: '600', borderRadius: '6px', height: '28px' }}
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handlePrintVerificationReport(po)}
                              style={{ padding: '4px 9px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: '600', borderRadius: '6px', height: '28px' }}
                              title="Print Audit Report"
                            >
                              <Printer size={12} />
                              <span>Print</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={() => handleDownloadVerificationPDF(po)}
                              style={{
                                padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: '700',
                                borderRadius: '6px', height: '28px', boxShadow: '0 1px 3px rgba(99, 102, 241, 0.25)'
                              }}
                              title="Download PDF Document"
                            >
                              <Download size={12} />
                              <span>PDF</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <PaginationBar
              page={allPoPage}
              setPage={setAllPoPage}
              rpp={allPoRpp}
              setRpp={setAllPoRpp}
              totalItems={displayPOs.length}
            />
          </div>
        ) : activeViewTab === 'accepted' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={18} />
                  <span>Accepted & Finalized Orders Table ({acceptedOrders.length})</span>
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Dedicated register of verified purchase orders where inward stock has been accepted and stored in warehouse racks.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8," + 
                      ["PO Number,Date,Type,Vendor,Material,Ordered Qty,Accepted Inward Qty,Inward Receipts (Bill & Date),Warehouse Location,Status"]
                      .concat(acceptedOrders.map(p => {
                        const bills = (p.partialEntries || []).map(e => `${e.invoiceNo} (${e.receivedQty} pcs)`).join('; ');
                        const locs = (p.partialEntries || []).map(e => e.location).filter(Boolean).join('; ') || 'Main Store';
                        const matName = (p.items && p.items[0]?.name) || p.partialEntries?.[0]?.materialName || 'Trim Item';
                        return `"${p.poNumber}","${p.date}","${p.type}","${p.vendor}","${matName}","${p.totalOrdered}","${p.approvedReceived}","${bills}","${locs}","Accepted"`;
                      }))
                      .join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `accepted_orders_records_${new Date().toISOString().slice(0, 10)}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #10b981', backgroundColor: 'rgba(16, 185, 129, 0.08)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '800', color: '#065f46', textTransform: 'uppercase' }}># / PO Number</th>
                    <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '800', color: '#065f46', textTransform: 'uppercase' }}>Vendor / Supplier</th>
                    <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '800', color: '#065f46', textTransform: 'uppercase' }}>Material Details</th>
                    <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '800', color: '#065f46', textTransform: 'uppercase', textAlign: 'center' }}>Ordered Qty</th>
                    <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '800', color: '#065f46', textTransform: 'uppercase', textAlign: 'center' }}>Accepted Inward</th>
                    <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '800', color: '#065f46', textTransform: 'uppercase' }}>Inward Receipts (Bill & Date)</th>
                    <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '800', color: '#065f46', textTransform: 'uppercase' }}>Warehouse Location</th>
                    <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '800', color: '#065f46', textTransform: 'uppercase', textAlign: 'center' }}>Authorization</th>
                    <th style={{ padding: '12px 10px', fontSize: '11.5px', fontWeight: '800', color: '#065f46', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {acceptedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <CheckCircle2 size={36} style={{ margin: '0 auto 10px auto', color: '#10b981', opacity: 0.5 }} />
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: 'var(--text-main)' }}>No Accepted Orders Found</h4>
                        <p style={{ margin: 0, fontSize: '12.5px' }}>
                          Orders that pass inward verification and admin approval will automatically be cataloged in this table.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedAcceptedOrders.map((po) => {
                      const matName = (po.items && po.items.length > 0 && (po.items[0]?.name || po.items[0]?.description)) || (po.partialEntries && po.partialEntries[0]?.materialName) || 'Trim Item';
                      const locationsList = Array.from(new Set((po.partialEntries || []).map(e => e.location).filter(Boolean)));

                      return (
                        <tr
                          key={po.poNumber}
                          style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                          className="hover-row"
                          onClick={() => setSelectedPO(po)}
                        >
                          <td style={{ padding: '14px 10px' }}>
                            <div style={{ fontWeight: '800', color: '#047857' }}>{po.poNumber}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{po.date}</div>
                            <span style={{
                              padding: '2px 6px', borderRadius: '4px', fontSize: '9.5px', fontWeight: 'bold',
                              backgroundColor: po.type === 'Zip' ? '#dbeafe' : (po.type === 'Doori' ? '#fef3c7' : '#d1fae5'),
                              color: po.type === 'Zip' ? '#1e40af' : (po.type === 'Doori' ? '#92400e' : '#065f46'),
                              display: 'inline-block', marginTop: '3px'
                            }}>
                              {po.type}
                            </span>
                          </td>
                          <td style={{ padding: '14px 10px', fontWeight: '600', color: 'var(--text-main)' }}>
                            {po.vendor}
                          </td>
                          <td style={{ padding: '14px 10px' }}>
                            <span style={{
                              padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '600',
                              backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)'
                            }}>
                              {matName}
                            </span>
                            {po.items && po.items.length > 1 && (
                              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                +{po.items.length - 1} other item{po.items.length > 2 ? 's' : ''}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '14px 10px', textAlign: 'center', fontWeight: '700', color: 'var(--text-main)' }}>
                            {po.totalOrdered} pcs
                          </td>
                          <td style={{ padding: '14px 10px', textAlign: 'center', fontWeight: '800', color: '#047857' }}>
                            <div style={{ fontSize: '13.5px' }}>{po.approvedReceived} pcs</div>
                            {po.extraBalance > 0 && (
                              <div style={{ fontSize: '10px', color: '#8b5cf6', fontWeight: 'bold' }}>
                                (+{po.extraBalance} Excess Accepted)
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '14px 10px', fontSize: '11.5px' }}>
                            {po.partialEntries && po.partialEntries.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {po.partialEntries.map((e, idx) => {
                                  const isManual = e.entryMode === 'Manually' || e.entryMode === 'Manual';
                                  const dateFormatted = e.date ? e.date.split(' ')[0] : 'N/A';

                                  return (
                                    <div key={idx} style={{
                                      display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap',
                                      background: 'var(--bg-secondary)', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border-color)'
                                    }}>
                                      <span style={{
                                        padding: '1px 4px', borderRadius: '3px', fontSize: '9px', fontWeight: '800',
                                        background: isManual ? '#eff6ff' : '#f0fdf4',
                                        color: isManual ? '#2563eb' : '#059669',
                                        border: `1px solid ${isManual ? '#bfdbfe' : '#bbf7d0'}`
                                      }}>
                                        {isManual ? '📝 Manual' : '⚖️ Scale'}
                                      </span>
                                      <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{e.invoiceNo}</span>
                                      <span style={{ color: '#047857', fontWeight: '700' }}>({e.receivedQty.toLocaleString()} {e.unit || 'Pcs'})</span>
                                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                        {!isManual && e.netWeightKg > 0 ? `• ${e.netWeightKg} kg` : ''} • {dateFormatted}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 10px', fontSize: '11.5px' }}>
                            {locationsList.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {locationsList.map((loc, lIdx) => (
                                  <span key={lIdx} style={{
                                    padding: '2px 7px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700',
                                    backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-color)'
                                  }}>
                                    📍 {loc}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Main Store</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 10px', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800',
                              backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #10b981', display: 'inline-block'
                            }}>
                              ✔ Accepted
                            </span>
                            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              In Stock
                            </div>
                          </td>
                          <td style={{ padding: '14px 10px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setSelectedPO(po)}
                                style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '600' }}
                              >
                                Details
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handlePrintVerificationReport(po)}
                                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '600' }}
                                title="Print Audit Report"
                              >
                                <Printer size={12} />
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleDownloadVerificationPDF(po)}
                                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '700' }}
                                title="Download PDF"
                              >
                                <Download size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <PaginationBar
                page={acceptedPage}
                setPage={setAcceptedPage}
                rpp={acceptedRpp}
                setRpp={setAcceptedRpp}
                totalItems={acceptedOrders.length}
              />
            </div>
          </div>
        ) : (
          /* Live timeline view */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
                <span>Checking weighbridge captures...</span>
              </div>
            ) : captures.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                No weighbridge captures exist in the database logs. Go to Material Add to log one.
              </div>
            ) : (
              <>
                {paginatedCaptures.map((cap) => {
                  const normPo = cap.poNumber ? String(cap.poNumber).trim().toLowerCase() : '';
                  const matchedPo = normPo ? unifiedPOs.find(p => String(p.poNumber).trim().toLowerCase() === normPo) : null;

                  return (
                    <div
                      key={cap.id}
                      className="hover-row"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px',
                        borderRadius: 'var(--border-radius-md)',
                        border: '1.5px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        flexWrap: 'wrap',
                        gap: '16px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%',
                          backgroundColor: (cap.entryMode === 'Manual' || cap.entryMode === 'Manually' || cap.status === 'Manual' || cap.status === 'Manually') ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: (cap.entryMode === 'Manual' || cap.entryMode === 'Manually' || cap.status === 'Manual' || cap.status === 'Manually') ? '#2563eb' : '#059669',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {(cap.entryMode === 'Manual' || cap.entryMode === 'Manually' || cap.status === 'Manual' || cap.status === 'Manually') ? <FileText size={20} style={{ margin: 'auto' }} /> : <Scale size={20} style={{ margin: 'auto' }} />}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '14.5px' }}>{cap.materialName}</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px' }}>
                              {cap.materialCode}
                            </span>
                            <span style={{
                              padding: '2px 7px', borderRadius: '12px', fontSize: '10.5px', fontWeight: '800',
                              backgroundColor: (cap.entryMode === 'Manual' || cap.entryMode === 'Manually' || cap.status === 'Manual' || cap.status === 'Manually') ? '#eff6ff' : '#f0fdf4',
                              color: (cap.entryMode === 'Manual' || cap.entryMode === 'Manually' || cap.status === 'Manual' || cap.status === 'Manually') ? '#2563eb' : '#059669',
                              border: `1px solid ${(cap.entryMode === 'Manual' || cap.entryMode === 'Manually' || cap.status === 'Manual' || cap.status === 'Manually') ? '#bfdbfe' : '#bbf7d0'}`
                            }}>
                              {(cap.entryMode === 'Manual' || cap.entryMode === 'Manually' || cap.status === 'Manual' || cap.status === 'Manually') ? '📝 Manually' : '⚖️ Weight Machine'}
                            </span>
                            {cap.poNumber ? (
                              <span style={{
                                padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                                backgroundColor: matchedPo ? '#d1fae5' : '#fee2e2',
                                color: matchedPo ? '#065f46' : '#991b1b'
                              }}>
                                PO: {cap.poNumber} {matchedPo ? `(${matchedPo.type})` : '(Unregistered)'}
                              </span>
                            ) : (
                              <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#f1f5f9', color: '#475569' }}>
                                Direct Inward
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '11.5px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <User size={12} />
                              <span>Operator: {cap.storeIncharge || 'Punnet'}</span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={12} />
                              <span>{cap.capturedAt ? new Date(cap.capturedAt).toLocaleString('en-GB') : (cap.date || 'N/A')}</span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Box size={12} />
                              <span>Location: {cap.storeLocation || 'Main Hall'}</span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Tag size={12} />
                              <span>Bill: {cap.invoiceNo || 'N/A'}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', textAlign: 'right' }}>
                        {(cap.entryMode === 'Manual' || cap.entryMode === 'Manually' || cap.status === 'Manual' || cap.status === 'Manually') ? (
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Inward Method</div>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: '#2563eb' }}>Manual Count ({cap.packets || 1} pkts)</div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Net Scale Weight</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>{cap.netWeightKg || cap.grossWeightKg || 0} kg <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({cap.packets || 1} pkts)</span></div>
                          </div>
                        )}
                        <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Quantity</div>
                          <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--accent-color)' }}>{Number(cap.pieces || 0).toLocaleString()} {cap.unit || 'pcs'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <PaginationBar
                  page={timelinePage}
                  setPage={setTimelinePage}
                  rpp={timelineRpp}
                  setRpp={setTimelineRpp}
                  totalItems={captures.length}
                />
              </>
            )}
          </div>
        )}

      </div>

      {/* PO Detail slide-out panel (Modal overlay) */}
      {selectedPO && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedPO(null)}
          style={{ zIndex: 1050 }}
        >
          <div
            className="modal-content animate-scale"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{
                  padding: '3px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 'bold',
                  backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)', textTransform: 'uppercase'
                }}>
                  {selectedPO.type} PO RECEIPT AUDIT
                </span>
                <h3 style={{ margin: '6px 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Verification Details for {selectedPO.poNumber}
                </h3>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedPO(null)}
                style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <X size={16} />
                <span>Close</span>
              </button>
            </div>

            {/* Meta statistics in drawer */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              <div style={{ padding: '10px', border: '1.5px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vendor</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginTop: '4px', wordBreak: 'break-word' }}>{selectedPO.vendor}</div>
              </div>
              <div style={{ padding: '10px', border: '1.5px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>PO Issue Date</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginTop: '4px' }}>{selectedPO.date}</div>
              </div>
              <div style={{ padding: '10px', border: '1.5px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target Ordered</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', marginTop: '4px' }}>{selectedPO.totalOrdered} pcs</div>
              </div>
              <div style={{ padding: '10px', border: '1.5px solid #10b981', borderRadius: 'var(--border-radius-md)', backgroundColor: '#ecfdf5' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#047857', textTransform: 'uppercase' }}>In Stock (Approved)</div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#047857', marginTop: '4px' }}>{selectedPO.approvedReceived || selectedPO.totalReceived || 0} pcs</div>
              </div>
              {selectedPO.pendingApprovalPieces > 0 && (
                <div style={{ padding: '10px', border: '1.5px solid #f59e0b', borderRadius: 'var(--border-radius-md)', backgroundColor: '#fffbeb' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#b45309', textTransform: 'uppercase' }}>Pending Approval</div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#b45309', marginTop: '4px' }}>{selectedPO.pendingApprovalPieces} pcs held</div>
                </div>
              )}
              <div style={{ padding: '10px', border: '1.5px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Match Status</div>
                <div style={{ marginTop: '4px' }}>
                  <span style={{
                    padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold',
                    color: selectedPO.verificationStatus === 'Matched' ? '#10b981' : (selectedPO.verificationStatus === 'Shortage' ? '#f43e5c' : (selectedPO.verificationStatus === 'Excess' ? '#8b5cf6' : '#64748b')),
                    backgroundColor: selectedPO.verificationStatus === 'Matched' ? 'rgba(16,185,129,0.1)' : (selectedPO.verificationStatus === 'Shortage' ? 'rgba(244,62,92,0.1)' : (selectedPO.verificationStatus === 'Excess' ? 'rgba(139,92,246,0.1)' : 'rgba(100,116,139,0.1)')),
                    textTransform: 'uppercase'
                  }}>
                    {selectedPO.verificationStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Audit mismatch alert */}
            {selectedPO.totalReceived > 0 && selectedPO.totalReceived !== selectedPO.totalOrdered && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: 'var(--border-radius-md)',
                backgroundColor: selectedPO.verificationStatus === 'Shortage' ? 'rgba(244, 62, 92, 0.06)' : 'rgba(139, 92, 246, 0.06)',
                border: `1.5px solid ${selectedPO.verificationStatus === 'Shortage' ? 'rgba(244, 62, 92, 0.2)' : 'rgba(139, 92, 246, 0.2)'}`,
                marginBottom: '20px'
              }}>
                {selectedPO.verificationStatus === 'Shortage' ? (
                  <>
                    <AlertTriangle size={22} style={{ color: '#f43e5c', flexShrink: 0 }} />
                    <span style={{ fontSize: '12.5px', color: '#f43e5c', fontWeight: '600' }}>
                      <strong>Discrepancy Warning (Shortage):</strong> Supplier has under-delivered. Received <strong>{selectedPO.totalReceived} pieces</strong>, which is <strong>{selectedPO.totalOrdered - selectedPO.totalReceived} pieces short</strong> of the ordered quantity.
                    </span>
                  </>
                ) : (
                  <>
                    <TrendingUp size={22} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                    <span style={{ fontSize: '12.5px', color: '#8b5cf6', fontWeight: '600' }}>
                      <strong>Delivery Notice (Excess):</strong> Supplier has over-delivered. Received <strong>{selectedPO.totalReceived} pieces</strong>, which is <strong>{selectedPO.totalReceived - selectedPO.totalOrdered} pieces extra</strong>.
                    </span>
                  </>
                )}
              </div>
            )}

            {/* 1. Itemized comparison table */}
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13.5px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              1. Detailed Item Matching
            </h4>
            <div className="table-responsive" style={{ marginBottom: '24px', border: '1.5px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                {selectedPO.type === 'General' && (
                  <>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1.5px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>#</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Shade</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>UOM</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Target (pcs)</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Recv (pcs)</th>
                        {isAdmin && (
                          <>
                            <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Rate</th>
                            <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.items.map((item, idx) => {
                        const received = selectedPO.items.length === 1 ? selectedPO.totalReceived : (selectedPO.itemizedReceived[item.name] || 0);
                        const rate = item.price || 50.00;
                        const amount = item.ordered * rate;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', fontWeight: '600', color: 'var(--text-main)' }}>
                              {item.dept || item.department || 'Trims'}
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', fontWeight: '700' }}>{item.name}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px' }}>{item.shade || '—'}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center' }}>{item.uom || 'PCS'}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center', fontWeight: 'bold' }}>{item.ordered}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-color)' }}>{received}</td>
                            {isAdmin && (
                              <>
                                <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right' }}>{currencySymbol} {rate.toFixed(2)}</td>
                                <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right', fontWeight: 'bold' }}>{currencySymbol} {amount.toFixed(2)}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                      <tr style={{ background: 'var(--bg-secondary)', borderTop: '1.5px solid var(--border-color)', fontWeight: 'bold' }}>
                        <td colSpan={5} style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right' }}>TOTAL QUANTITY:</td>
                        <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center' }}>{selectedPO.totalOrdered}</td>
                        <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center', color: 'var(--accent-color)' }}>{selectedPO.totalReceived}</td>
                        {isAdmin && (
                          <>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right' }}>—</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right' }}>
                              {currencySymbol} {(selectedPO.totalCost ? Number(selectedPO.totalCost) : selectedPO.items.reduce((sum, item) => sum + (item.ordered * (item.price || 50.00)), 0)).toFixed(2)}
                            </td>
                          </>
                        )}
                      </tr>
                    </tbody>
                  </>
                )}

                {(selectedPO.type === 'Zip' || selectedPO.type === 'Doori') && (
                  <>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1.5px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>{selectedPO.type.toUpperCase()} TYPE</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>PLACEMENT</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>COLOUR</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>ZIP COLOUR</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>QUANTITY</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>RECV QTY</th>
                        {isAdmin && (
                          <>
                            <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>PRICE</th>
                            <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>TOTAL</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.items.map((item, idx) => {
                        const zipType = item.zipType || item.doriType || (selectedPO.type === 'Zip' ? 'BACK POCKET ZIP' : 'Dori Thread');
                        const placement = item.placement || 'Main';
                        const colour = item.colour || 'Black';
                        const zipColour = item.zipColour || item.doriColour || 'Black';
                        const price = item.price || 4.5;
                        const totalCost = item.ordered * price;

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', fontWeight: '700' }}>{zipType}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px' }}>{placement}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center' }}>{colour}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center' }}>{zipColour}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center', fontWeight: 'bold' }}>{item.ordered}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-color)' }}>{selectedPO.items.length === 1 ? selectedPO.totalReceived : (selectedPO.itemizedReceived[item.name] || 0)}</td>
                            {isAdmin && (
                              <>
                                <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right' }}>{currencySymbol} {Number(price).toFixed(2)}</td>
                                <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right', fontWeight: 'bold' }}>{currencySymbol} {totalCost.toFixed(2)}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </>
                )}

                {selectedPO.type === 'RGP' && (
                  <>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1.5px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>#</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>Lot No</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>Department</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>Description</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>Purpose</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>UOM</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Issued Qty</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Returned Qty</th>
                        <th style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Bags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.items.map((item, idx) => {
                        const received = selectedPO.items.length === 1 ? selectedPO.totalReceived : (selectedPO.itemizedReceived[item.name] || 0);
                        
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', fontWeight: 'bold' }}>{item.lotNo || selectedPO.poNumber}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px' }}>{item.dept || 'Stitching'}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', fontWeight: '700' }}>{item.name}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px' }}>{item.purpose || 'Stitching'}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center' }}>{item.uom || 'PCS'}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center', fontWeight: 'bold' }}>{item.ordered}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-color)' }}>{received}</td>
                            <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center' }}>{item.bags || '0'}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: 'var(--bg-secondary)', borderTop: '1.5px solid var(--border-color)', fontWeight: 'bold' }}>
                        <td colSpan={6} style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'right' }}>TOTAL QUANTITY:</td>
                        <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center' }}>
                          {selectedPO.items.reduce((sum, item) => sum + (Number(item.ordered) || 0), 0)}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center', color: 'var(--accent-color)' }}>
                          {selectedPO.totalReceived}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12.5px', textAlign: 'center' }}>
                          {selectedPO.items.reduce((sum, item) => sum + (Number(item.bags) || 0), 0)}
                        </td>
                      </tr>
                    </tbody>
                  </>
                )}

                {selectedPO.type === 'Unregistered PO' && (
                  <>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1.5px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Material Description</th>
                        <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>Ordered Qty (pcs)</th>
                        <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>Received Qty (pcs)</th>
                        <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>Difference Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700' }}>Standard Trim shipment</td>
                        <td style={{ padding: '12px', fontSize: '13px', textAlign: 'center', fontWeight: 'bold' }}>{selectedPO.totalOrdered}</td>
                        <td style={{ padding: '12px', fontSize: '13px', textAlign: 'center', fontWeight: 'bold' }}>{selectedPO.totalReceived}</td>
                        <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', fontWeight: '800', color: '#8b5cf6' }}>
                          +{selectedPO.totalReceived} Excess (+100.0%)
                        </td>
                      </tr>
                    </tbody>
                  </>
                )}
              </table>
            </div>

            {/* 2. Weight captures details: Step-by-step Inward Receipts */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 10px 0' }}>
              <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                2. Inward Receipts & Partial Deliveries Record
              </h4>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                {selectedPO.partialEntries?.length || 0} Inward Entry/Entries Logged
              </span>
            </div>

            <div className="table-responsive" style={{ border: '1.5px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1.5px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Step #</th>
                    <th style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date Received</th>
                    <th style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bill / Invoice No</th>
                    <th style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Material Name</th>
                    <th style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Inward Method</th>
                    <th style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Received Qty</th>
                    <th style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Weight & Scale Details</th>
                    <th style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Extra / Balance</th>
                    <th style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Approval & Stock</th>
                    <th style={{ padding: '10px 10px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPO.partialEntries && selectedPO.partialEntries.length > 0 ? (
                    paginatedModalSteps.map((entry) => {
                      const isPendingApp = entry.approvalStatus === 'Pending Approval';
                      const isApproved = entry.approvalStatus === 'Approved';
                      const isRejected = entry.approvalStatus === 'Rejected';
                      const isManual = entry.entryMode === 'Manually' || entry.entryMode === 'Manual';

                      return (
                        <tr key={entry.id} style={{
                          borderBottom: '1px solid var(--border-color)',
                          backgroundColor: isPendingApp ? 'rgba(245, 158, 11, 0.04)' : (isRejected ? 'rgba(244, 62, 92, 0.04)' : 'transparent')
                        }}>
                          <td style={{ padding: '11px 10px', fontSize: '12.5px', textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                            #{entry.stepNo}
                          </td>
                          <td style={{ padding: '11px 10px', fontSize: '12px', color: 'var(--text-main)' }}>
                            {entry.date}
                          </td>
                          <td style={{ padding: '11px 10px', fontSize: '12.5px', fontWeight: '700', color: 'var(--accent-color)' }}>
                            {entry.invoiceNo}
                          </td>
                          <td style={{ padding: '11px 10px', fontSize: '12.5px', fontWeight: '700', color: 'var(--text-main)' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--accent-light)',
                              color: 'var(--accent-color)',
                              fontSize: '12px'
                            }}>
                              {entry.materialName}
                            </span>
                            {entry.materialCode && entry.materialCode !== 'N/A' && (
                              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                                {entry.materialCode}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '11px 10px', fontSize: '11px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '3px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: '800',
                              backgroundColor: isManual ? '#eff6ff' : '#f0fdf4',
                              color: isManual ? '#2563eb' : '#059669',
                              border: `1px solid ${isManual ? '#bfdbfe' : '#bbf7d0'}`
                            }}>
                              {isManual ? '📝 Manually' : '⚖️ Weight Machine'}
                            </span>
                          </td>
                          <td style={{ padding: '11px 10px', fontSize: '12.5px', textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                            +{entry.receivedQty.toLocaleString()} {entry.unit || 'Pcs'}
                          </td>
                          <td style={{ padding: '11px 10px', fontSize: '11.5px', color: 'var(--text-main)' }}>
                            {isManual ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontWeight: '700', color: '#2563eb' }}>Manual Quantity Count</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>📦 {entry.packets || 1} Packets • Direct Inward (No Scale)</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontWeight: '800', color: '#0f172a' }}>
                                  Net: <strong style={{ color: '#059669' }}>{entry.netWeightKg} kg</strong> {entry.grossWeightKg > 0 && <span style={{ color: '#64748b', fontWeight: 'normal' }}>(Gross: {entry.grossWeightKg} kg)</span>}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                  📦 {entry.packets || 1} Packets {entry.weightPerPieceG > 0 && `• Avg: ${entry.weightPerPieceG}g/pc`}
                                </span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '11px 10px', fontSize: '12px', textAlign: 'center', fontWeight: '800' }}>
                            {entry.extraQty > 0 ? (
                              <span style={{ color: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.12)', padding: '3px 10px', borderRadius: '12px' }}>
                                +{entry.extraQty} Extra
                              </span>
                            ) : entry.remainingBalance > 0 ? (
                              <span style={{ color: '#f43e5c', backgroundColor: 'rgba(244, 62, 92, 0.12)', padding: '3px 10px', borderRadius: '12px' }}>
                                {entry.remainingBalance} Pending
                              </span>
                            ) : (
                              <span style={{ color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '3px 10px', borderRadius: '12px' }}>
                                Exact Match
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '11px 10px', fontSize: '11px', textAlign: 'center' }}>
                            {isPendingApp ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                <span style={{
                                  padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800',
                                  backgroundColor: '#fef3c7', color: '#b45309', border: '1.5px solid #f59e0b'
                                }}>
                                  ⏳ Pending Admin Response
                                </span>
                                <span style={{ fontSize: '10px', color: '#b45309', fontWeight: '600' }}>
                                  {entry.extraQty > 0 ? `> 3% Extra (+${entry.extraQty} pcs)` : 'Pending Verification'} • Not in Stock
                                </span>
                              </div>
                            ) : isRejected ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{
                                  padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800',
                                  backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #f43e5c'
                                }}>
                                  ✖ Rejected by Admin
                                </span>
                                <span style={{ fontSize: '10px', color: '#b91c1c' }}>Not Stored • Return to Vendor</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{
                                  padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800',
                                  backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #10b981'
                                }}>
                                  ✔ Accepted by Admin
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Finalized in {entry.location}</span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '11px 10px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                              {isPendingApp && isAdmin && (
                                <>
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleApproveInward(entry.id)}
                                    style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '700' }}
                                    title="Authorize Excess & Store in Inventory"
                                  >
                                    <CheckCircle2 size={12} />
                                    <span>Approve & Store</span>
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleRejectInward(entry.id)}
                                    style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '700' }}
                                    title="Reject Shipment & Return to Vendor"
                                  >
                                    <XCircle size={12} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handlePrintSingleReceipt(selectedPO, entry)}
                                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '600' }}
                                title={`Print Receipt Step #${entry.stepNo}`}
                              >
                                <Printer size={12} />
                                <span>Print</span>
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleDownloadSingleReceiptPDF(selectedPO, entry)}
                                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '700' }}
                                title={`Download PDF for Step #${entry.stepNo}`}
                              >
                                <Download size={12} />
                                <span>PDF</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No inward receipts logged yet for this PO.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <PaginationBar
                page={modalStepPage}
                setPage={setModalStepPage}
                rpp={modalStepRpp}
                setRpp={setModalStepRpp}
                totalItems={selectedPO?.partialEntries?.length || 0}
                rppOptions={[3, 5, 10, 20]}
              />
            </div>

            {/* Actions block in drawer */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedPO(null)}
              >
                Close
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handlePrintVerificationReport(selectedPO)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
              >
                <Printer size={15} />
                <span>Print Report</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleDownloadVerificationPDF(selectedPO)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}
              >
                <Download size={15} />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
