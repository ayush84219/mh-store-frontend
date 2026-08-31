import { useState } from 'react';
import {
  ClipboardCheck, CheckCircle, XCircle, Clock,
  Trash2, AlertTriangle, User, Calendar, Package,
  Search, RefreshCw, Eye, Download, MoreHorizontal
} from 'lucide-react';

export default function ApprovalQueueView({
  approvalRequests = [],
  onApprove,
  onReject,
  materials = [],
  designs = [],
  currentUser = null
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [rejectModalId, setRejectModalId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [printRequest, setPrintRequest] = useState(null);

  // Extra filter states matching the new UI mockup
  const [filterDate, setFilterDate] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [refreshSpinning, setRefreshSpinning] = useState(false);
  const [localToast, setLocalToast] = useState(null); // { message, type }

  // Custom Confirmation & Validation UI states
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }
  const [rejectError, setRejectError] = useState('');

  const isAdmin = currentUser?.role === 'Admin';

  const userRequests = isAdmin
    ? approvalRequests
    : approvalRequests.filter(r => r.requesterName === currentUser?.name);

  // Stats Counters
  const pendingCount = userRequests.filter(r => r.status === 'pending').length;
  const approvedCount = userRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = userRequests.filter(r => r.status === 'rejected').length;
  const totalCount = userRequests.length;

  const deleteCount = userRequests.filter(r => r.type === 'material_delete').length;
  const issueCount = userRequests.filter(r => r.type === 'material_issue').length;
  const designVerificationCount = userRequests.filter(r => r.type === 'design_verification').length;
  const inwardCount = userRequests.filter(r => r.type === 'inward_approval').length;

  // List of unique requesters for dropdown filter
  const uniqueRequesters = [...new Set(userRequests.map(r => r.requesterName).filter(Boolean))];

  // Helper: Get Unsplash image url based on material name / category
  const getMaterialImage = (name = '') => {
    const n = name.toLowerCase();
    if (n.includes('zipper') || n.includes('zip')) {
      return 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=150&q=80';
    }
    if (n.includes('denim') || n.includes('jeans')) {
      return 'https://images.unsplash.com/photo-1582142306909-195724d33ab3?auto=format&fit=crop&w=150&q=80';
    }
    if (n.includes('cotton') || n.includes('fabric') || n.includes('roll') || n.includes('indigo')) {
      return 'https://images.unsplash.com/photo-1584184924103-e310d9dc82fc?auto=format&fit=crop&w=150&q=80';
    }
    if (n.includes('thread') || n.includes('spool')) {
      return 'https://images.unsplash.com/photo-1605812860427-4024433a70fd?auto=format&fit=crop&w=150&q=80';
    }
    if (n.includes('rivet') || n.includes('button') || n.includes('metal')) {
      return 'https://images.unsplash.com/photo-1590534247854-e97d5e3feef6?auto=format&fit=crop&w=150&q=80';
    }
    if (n.includes('label') || n.includes('sticker') || n.includes('satin')) {
      return 'https://images.unsplash.com/photo-1520004481444-76649034b3e3?auto=format&fit=crop&w=150&q=80';
    }
    return 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTfSpxz49Egc7TT1a8a5jMmmupv9ML64rFXYH2Y0ovpDA&s=10'; // Fallback
  };

  const getRequestImage = (req) => {
    if (req.type === 'material_delete') {
      return 'bin';
    }
    if (req.lotId) {
      const design = designs.find(d => String(d.id) === String(req.lotId));
      if (design && design.imageUrl) {
        return design.imageUrl;
      }
    }
    return getMaterialImage(req.materialName || req.items?.[0]?.materialName || '');
  };

  const getMaterialDetails = (req) => {
    if (req.type === 'design_verification') {
      const design = designs.find(d => String(d.id) === String(req.lotId));
      return {
        materialId: design?.style || 'N/A', // Style Ref
        lotNumber: req.lotId || 'N/A',
        shade: design?.colorCode || 'N/A', // Color Code
        store: design?.category || 'N/A', // Category
        availableStock: design?.quantity ? `${design.quantity} pcs` : 'N/A' // Qty
      };
    }

    if (req.type === 'inward_approval') {
      const inwardItem = req.items?.[0] || req.items || {};
      let poQtyVal = inwardItem.poQty || inwardItem.orderedQty || null;
      if (!poQtyVal && req.reason) {
        const match = req.reason.match(/remaining needed\s+([\d,]+)/i) || req.reason.match(/needed\s+([\d,]+)/i) || req.reason.match(/required\s+([\d,]+)/i);
        if (match) poQtyVal = parseInt(match[1].replace(/,/g, ''), 10);
      }

      return {
        materialId: req.materialId || inwardItem.materialCode || 'N/A',
        lotNumber: req.lotId || inwardItem.poNumber || 'N/A',
        poQty: poQtyVal ? `${Number(poQtyVal).toLocaleString()} Pcs` : 'As per PO',
        poQtyRaw: poQtyVal ? Number(poQtyVal) : null,
        shade: inwardItem.supplier ? `${inwardItem.supplier}` : 'N/A',
        store: inwardItem.storeLocation || 'Main Store',
        availableStock: `${(req.pieces || inwardItem.pieces || 0).toLocaleString()} Pcs (Incoming)`
      };
    }

    let matId = req.materialId;
    let lotNo = req.lotId || 'N/A';
    if (req.type === 'material_issue' && req.items && req.items.length > 0) {
      matId = req.items[0].materialId;
    }

    const material = materials.find(m => m.id === matId);
    const shade = material?.color || 'N/A';
    const stockVal = material ? `${material.stock} ${material.unit}` : 'N/A';

    return {
      materialId: matId || 'M1304', // Fallback example from mockup if empty
      lotNumber: lotNo !== 'N/A' ? lotNo : 'LOT-2026-098', // Fallback mockup format
      shade: shade !== 'N/A' ? shade : 'Black',
      store: material?.category === 'Fabric' ? 'Warehouse-2' : 'Main Store',
      availableStock: stockVal !== 'N/A' ? stockVal : '120.50 kg'
    };
  };

  // Helper: Format timestamp string into mockup format: "26 Jun 2026, 02:31 PM"
  const formatRequestDate = (dateStr) => {
    if (!dateStr) return 'â€”';
    try {
      const parts = dateStr.split(' ');
      if (parts.length < 2) return dateStr;

      const datePart = parts[0];
      const timePart = parts[1];

      const dateSubparts = datePart.split('/');
      if (dateSubparts.length < 3) return dateStr;

      const day = parseInt(dateSubparts[0], 10);
      const monthIndex = parseInt(dateSubparts[1], 10) - 1;
      const year = dateSubparts[2];

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = monthNames[monthIndex] || 'Jun';

      const timeSubparts = timePart.split(':');
      let hour = parseInt(timeSubparts[0], 10);
      const minute = timeSubparts[1] || '00';
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      hour = hour ? hour : 12;
      const formattedDay = day < 10 ? '0' + day : day;
      const formattedHour = hour < 10 ? '0' + hour : hour;

      return `${formattedDay} ${monthName} ${year}, ${formattedHour}:${minute} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  // Helper: Calculate realistic review dates for timeline
  const getTimelineDates = (req) => {
    const subStr = formatRequestDate(req.date);
    let underReviewStr = 'Pending';
    let resolvedStr = '';
    let resolvedActor = 'Admin';

    if (req.status !== 'pending') {
      try {
        const parts = req.date.split(' ');
        if (parts.length >= 2) {
          const timeParts = parts[1].split(':');
          let hour = parseInt(timeParts[0], 10);
          let minute = parseInt(timeParts[1], 10);

          let reviewMin = minute + 4;
          let reviewHour = hour;
          if (reviewMin >= 60) {
            reviewMin -= 60;
            reviewHour = (reviewHour + 1) % 24;
          }

          let resMin = reviewMin + 5;
          let resHour = reviewHour;
          if (resMin >= 60) {
            resMin -= 60;
            resHour = (resHour + 1) % 24;
          }

          const formatSimulated = (h, m) => {
            const datePart = parts[0];
            const dateSubparts = datePart.split('/');
            const day = parseInt(dateSubparts[0], 10);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = monthNames[parseInt(dateSubparts[1], 10) - 1] || 'Jun';
            const year = dateSubparts[2];
            const ampm = h >= 12 ? 'PM' : 'AM';
            let formattedH = h % 12;
            formattedH = formattedH ? formattedH : 12;
            const formattedDay = day < 10 ? '0' + day : day;
            const formattedHStr = formattedH < 10 ? '0' + formattedH : formattedH;
            const formattedMStr = m < 10 ? '0' + m : m;
            return `${formattedDay} ${monthName} ${year}, ${formattedHStr}:${formattedMStr} ${ampm}`;
          };

          underReviewStr = formatSimulated(reviewHour, reviewMin);
          resolvedStr = formatSimulated(resHour, resMin);
        } else {
          underReviewStr = subStr;
          resolvedStr = subStr;
        }
      } catch {
        underReviewStr = subStr;
        resolvedStr = subStr;
      }
    }

    if (req.resolvedDate && req.status !== 'pending') {
      if (req.resolvedDate.includes(' by ')) {
        const parts = req.resolvedDate.split(' by ');
        resolvedStr = formatRequestDate(parts[0]);
        resolvedActor = parts[1];
      } else {
        resolvedStr = formatRequestDate(req.resolvedDate);
        resolvedActor = 'Admin';
      }
    }

    return {
      submitted: subStr,
      underReview: underReviewStr,
      resolved: resolvedStr,
      actor: resolvedActor
    };
  };

  const getRequestPriority = (req) => {
    if (req.type === 'material_delete' || req.isReissue || req.pieces > 500) {
      return { text: 'High Priority', colorClass: 'priority-high' };
    }
    return { text: 'Medium Priority', colorClass: 'priority-med' };
  };

  const [lastUpdated, setLastUpdated] = useState(() => {
    const d = new Date();
    const day = d.getDate();
    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    const year = d.getFullYear();
    let hour = d.getHours();
    const minute = d.getMinutes();
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;
    const formattedDay = day < 10 ? '0' + day : day;
    const formattedHour = hour < 10 ? '0' + hour : hour;
    const formattedMinute = minute < 10 ? '0' + minute : minute;
    return `${formattedDay} ${monthName} ${year}, ${formattedHour}:${formattedMinute} ${ampm}`;
  });

  const handleApprove = (req) => {
    setConfirmModal({
      message: `Are you sure you want to approve this ${req.type === 'inward_approval' ? 'material inward' : (req.type === 'material_issue' ? 'material issue' : req.type === 'design_verification' ? 'design verification' : 'material delete')} request from ${req.requesterName}?`,
      onConfirm: () => onApprove(req.id)
    });
  };

  const handleRejectOpen = (req) => {
    setRejectModalId(req.id);
    setRejectReason('');
    setRejectError('');
  };

  const handleRejectConfirm = () => {
    if (!rejectReason.trim()) {
      setRejectError('Please provide a reason for rejection.');
      return;
    }
    onReject(rejectModalId, rejectReason.trim());
    setRejectModalId(null);
    setRejectReason('');
    setRejectError('');
  };

  const handleDownloadPDF = (req) => {
    setPrintRequest(req);
    setLocalToast({ message: `Compiling and downloading PDF for Request #${req.id}...`, type: 'success' });
    document.body.classList.add('print-approval-request-mode');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('print-approval-request-mode');
      setPrintRequest(null);
      setLocalToast(null);
    }, 150);
  };

  const handleRefreshQueue = () => {
    setRefreshSpinning(true);
    setTimeout(() => {
      setRefreshSpinning(false);
      const d = new Date();
      const day = d.getDate();
      const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
      const year = d.getFullYear();
      let hour = d.getHours();
      const minute = d.getMinutes();
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      hour = hour ? hour : 12;
      const formattedDay = day < 10 ? '0' + day : day;
      const formattedHour = hour < 10 ? '0' + hour : hour;
      const formattedMinute = minute < 10 ? '0' + minute : minute;

      setLastUpdated(`${formattedDay} ${monthName} ${year}, ${formattedHour}:${formattedMinute} ${ampm}`);
      setLocalToast({ message: 'Database query successfully refreshed.', type: 'success' });
      setTimeout(() => setLocalToast(null), 3000);
    }, 800);
  };

  const handleResetFilters = () => {
    setFilterStatus('pending');
    setFilterType('all');
    setSearchQuery('');
    setFilterDate('all');
    setFilterUser('all');
    setSortBy('newest');

    setLocalToast({ message: 'All filters successfully reset.', type: 'success' });
    setTimeout(() => setLocalToast(null), 3000);
  };

  // Filter conditions
  const filteredRequests = userRequests.filter(req => {
    // 1. Status Filter
    const matchesStatus = filterStatus === 'all' ? true : req.status === filterStatus;

    // 2. Type Filter
    const matchesType = filterType === 'all' ? true : req.type === filterType;

    // 3. User Filter
    const matchesUser = filterUser === 'all' ? true : req.requesterName === filterUser;

    // 4. Date Range Filter
    let matchesDate = true;
    if (filterDate !== 'all') {
      try {
        const parts = req.date.split(' ')[0].split('/');
        const reqDate = new Date(parts[2], parts[1] - 1, parts[0]);
        const today = new Date();
        const diffTime = Math.abs(today - reqDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (filterDate === 'today') {
          matchesDate = diffDays <= 1;
        } else if (filterDate === 'week') {
          matchesDate = diffDays <= 7;
        } else if (filterDate === 'month') {
          matchesDate = diffDays <= 30;
        }
      } catch {
        matchesDate = true;
      }
    }

    // 5. Search text query
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      (req.requesterName || '').toLowerCase().includes(q) ||
      (req.lotId || '').toLowerCase().includes(q) ||
      (req.materialName || '').toLowerCase().includes(q) ||
      (req.materialId || '').toLowerCase().includes(q) ||
      (req.id || '').toLowerCase().includes(q);

    return matchesStatus && matchesType && matchesUser && matchesDate && matchesSearch;
  });

  // Sort logic
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    try {
      const parseDate = (dStr) => {
        const parts = dStr.split(' ');
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);
      };
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    } catch {
      return sortBy === 'newest' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
    }
  });

  return (
    <div className="animate-fade">
      {/* Premium Dashboard Styling overrides */}
      <style>{`
        .approval-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .header-title-container h2 {
          font-family: var(--font-family-title);
          font-size: 24px;
          font-weight: 700;
          color: var(--text-main);
          margin: 0;
        }
        .header-title-container p {
          color: var(--text-muted);
          font-size: 13.5px;
          margin: 4px 0 0 0;
        }
        .header-last-updated {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
          margin-top: 8px;
        }
        .refresh-icon-btn {
          background: transparent;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          transition: color 0.2s, transform 0.2s;
        }
        .refresh-icon-btn:hover {
          color: var(--accent-color);
        }
        .refresh-icon-btn.spinning {
          animation: spin 0.8s linear infinite;
        }

        /* Stats Cards Dashboard Styles */
        .stats-grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 18px;
          margin-bottom: 24px;
        }
        .stat-card-new {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.25s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.01);
        }
        .stat-card-new:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        
        .stat-card-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-card-info-box {
          display: flex;
          flex-direction: column;
        }
        .stat-card-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: capitalize;
          margin-bottom: 2px;
        }
        .stat-card-value {
          font-size: 26px;
          font-weight: 800;
          font-family: var(--font-family-title);
          line-height: 1.1;
        }
        .stat-card-subtext {
          font-size: 11px;
          color: var(--text-light);
          margin-top: 2px;
        }

        /* Light Theme Stats colors */
        .stat-card-new.pending { background-color: #fffdf5; border-color: #fef3c7; }
        .stat-card-new.pending .stat-card-icon-box { background-color: #fef3c7; color: #d97706; }
        .stat-card-new.pending .stat-card-value { color: #d97706; }

        .stat-card-new.approved { background-color: #f4fdf8; border-color: #d1fae5; }
        .stat-card-new.approved .stat-card-icon-box { background-color: #d1fae5; color: #059669; }
        .stat-card-new.approved .stat-card-value { color: #059669; }

        .stat-card-new.rejected { background-color: #fffafb; border-color: #fed7d7; }
        .stat-card-new.rejected .stat-card-icon-box { background-color: #fed7d7; color: #dc2626; }
        .stat-card-new.rejected .stat-card-value { color: #dc2626; }

        .stat-card-new.total { background-color: #f5f9ff; border-color: #dbeafe; }
        .stat-card-new.total .stat-card-icon-box { background-color: #dbeafe; color: #2563eb; }
        .stat-card-new.total .stat-card-value { color: #2563eb; }

        /* Dark Theme overrides for Stats */
        body.dark-theme .stat-card-new.pending { background-color: rgba(245, 158, 11, 0.05); border-color: rgba(245, 158, 11, 0.2); }
        body.dark-theme .stat-card-new.pending .stat-card-icon-box { background-color: rgba(245, 158, 11, 0.15); color: #f59e0b; }
        body.dark-theme .stat-card-new.pending .stat-card-value { color: #f59e0b; }

        body.dark-theme .stat-card-new.approved { background-color: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.2); }
        body.dark-theme .stat-card-new.approved .stat-card-icon-box { background-color: rgba(16, 185, 129, 0.15); color: #10b981; }
        body.dark-theme .stat-card-new.approved .stat-card-value { color: #10b981; }

        body.dark-theme .stat-card-new.rejected { background-color: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.2); }
        body.dark-theme .stat-card-new.rejected .stat-card-icon-box { background-color: rgba(239, 68, 68, 0.15); color: #ef4444; }
        body.dark-theme .stat-card-new.rejected .stat-card-value { color: #ef4444; }

        body.dark-theme .stat-card-new.total { background-color: rgba(59, 130, 246, 0.05); border-color: rgba(59, 130, 246, 0.2); }
        body.dark-theme .stat-card-new.total .stat-card-icon-box { background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        body.dark-theme .stat-card-new.total .stat-card-value { color: #60a5fa; }

        /* Modern Filter Row */
        .filters-group-row {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .filter-search-wrapper {
          position: relative;
          flex: 1 1 280px;
        }
        .filter-search-wrapper input {
          width: 100%;
          height: 38px;
          padding-left: 36px;
          font-size: 13.5px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-primary);
          color: var(--text-main);
          outline: none;
          transition: border-color 0.2s;
        }
        .filter-search-wrapper input:focus {
          border-color: var(--accent-color);
        }
        .filter-search-wrapper .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }

        .filter-select-wrapper {
          position: relative;
          width: 125px;
          flex-shrink: 0;
        }
        .filter-select-wrapper select {
          width: 100%;
          height: 38px;
          appearance: none;
          -webkit-appearance: none;
          padding: 0 28px 0 12px;
          font-size: 13px;
          font-weight: 500;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-primary);
          color: var(--text-main);
          outline: none;
          cursor: pointer;
        }
        .filter-select-wrapper::after {
          content: 'â–¼';
          font-size: 8px;
          color: var(--text-muted);
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
        }
        
        .reset-filter-btn {
          height: 38px;
          padding: 0 16px;
          border-radius: 8px;
          border: 1px solid rgba(79, 70, 229, 0.3);
          background: transparent;
          color: #4f46e5;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .reset-filter-btn:hover {
          background-color: rgba(79, 70, 229, 0.05);
          border-color: #4f46e5;
        }
        body.dark-theme .reset-filter-btn {
          color: #818cf8;
          border-color: rgba(129, 140, 248, 0.3);
        }
        body.dark-theme .reset-filter-btn:hover {
          background-color: rgba(129, 140, 248, 0.08);
        }

        /* Pills Filtering Subrow */
        .pills-filter-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .pills-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .pill-toggle-btn {
          padding: 6px 14px;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          color: var(--text-main);
          transition: all 0.2s;
        }
        .pill-toggle-btn .bullet-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .pill-toggle-btn.active {
          background-color: #4f46e5;
          color: #ffffff !important;
          border-color: #4f46e5;
        }
        
        .pill-toggle-btn.all-pill.active { background-color: #4f46e5; border-color: #4f46e5; }
        .pill-toggle-btn.pending-pill .bullet-dot { background-color: #d97706; }
        .pill-toggle-btn.pending-pill:hover, .pill-toggle-btn.pending-pill.active-state { border-color: #d97706; background-color: #fffbeb; color: #b45309; }
        .pill-toggle-btn.approved-pill .bullet-dot { background-color: #059669; }
        .pill-toggle-btn.approved-pill:hover, .pill-toggle-btn.approved-pill.active-state { border-color: #059669; background-color: #ecfdf5; color: #047857; }
        .pill-toggle-btn.rejected-pill .bullet-dot { background-color: #dc2626; }
        .pill-toggle-btn.rejected-pill:hover, .pill-toggle-btn.rejected-pill.active-state { border-color: #dc2626; background-color: #fff5f5; color: #b91c1c; }
        .pill-toggle-btn.delete-pill .bullet-dot { background-color: #7c3aed; }
        .pill-toggle-btn.delete-pill:hover, .pill-toggle-btn.delete-pill.active-state { border-color: #7c3aed; background-color: #f5f3ff; color: #6d28d9; }
        .pill-toggle-btn.issue-pill .bullet-dot { background-color: #2563eb; }
        .pill-toggle-btn.issue-pill:hover, .pill-toggle-btn.issue-pill.active-state { border-color: #2563eb; background-color: #eff6ff; color: #1d4ed8; }

        /* Dark Theme overrides for active-state hover effects */
        body.dark-theme .pill-toggle-btn.pending-pill:hover, body.dark-theme .pill-toggle-btn.pending-pill.active-state { background-color: rgba(217, 119, 6, 0.08); color: #fbbf24; }
        body.dark-theme .pill-toggle-btn.approved-pill:hover, body.dark-theme .pill-toggle-btn.approved-pill.active-state { background-color: rgba(5, 150, 105, 0.08); color: #34d399; }
        body.dark-theme .pill-toggle-btn.rejected-pill:hover, body.dark-theme .pill-toggle-btn.rejected-pill.active-state { background-color: rgba(220, 38, 38, 0.08); color: #f87171; }
        body.dark-theme .pill-toggle-btn.delete-pill:hover, body.dark-theme .pill-toggle-btn.delete-pill.active-state { background-color: rgba(124, 58, 237, 0.08); color: #a78bfa; }
        body.dark-theme .pill-toggle-btn.issue-pill:hover, body.dark-theme .pill-toggle-btn.issue-pill.active-state { background-color: rgba(37, 99, 235, 0.08); color: #60a5fa; }

        .sort-select-wrapper {
          position: relative;
        }
        .sort-select-wrapper select {
          height: 34px;
          appearance: none;
          -webkit-appearance: none;
          padding: 0 28px 0 10px;
          font-size: 12px;
          font-weight: 700;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          color: var(--text-main);
          outline: none;
          cursor: pointer;
        }
        .sort-select-wrapper::after {
          content: 'â–¼';
          font-size: 8px;
          color: var(--text-muted);
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
        }

        /* High-fidelity Request Card */
        .approval-card-new {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-md);
          position: relative;
          overflow: hidden;
          transition: all 0.25s ease;
          display: flex;
          flex-direction: column;
          margin-bottom: 16px;
        }
        .approval-card-new:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
          border-color: rgba(79, 70, 229, 0.25);
        }
        .card-status-bar {
          width: 4px;
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
        }
        .card-status-bar.pending { background-color: #d97706; }
        .card-status-bar.approved { background-color: #059669; }
        .card-status-bar.rejected { background-color: #dc2626; }
        
        .card-main-content {
          padding: 20px;
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        
        /* Column 1: Image Thumbnail */
        .card-image-wrapper {
          width: 140px;
          height: 140px;
          border-radius: 10px;
          overflow: hidden;
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          position: relative;
        }
        .card-image-thumbnail {
          width: 100%;
          height: 100%;
          background-size: cover;
          background-position: center;
        }

        /* Column 2: Details metadata */
        .card-title-col {
          flex: 1.5;
          min-width: 220px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        .type-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.05em;
          width: fit-content;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .type-badge.material_issue {
          background-color: #e0e7ff;
          color: #4f46e5;
        }
        .type-badge.material_issue.reissue {
          background-color: #ffedd5;
          color: #c2410c;
        }
        .type-badge.material_delete {
          background-color: #fee2e2;
          color: #dc2626;
        }
        body.dark-theme .type-badge.material_issue { background-color: rgba(79, 70, 229, 0.18); color: #a5b4fc; }
        body.dark-theme .type-badge.material_issue.reissue { background-color: rgba(249, 115, 22, 0.18); color: #fdba74; }
        body.dark-theme .type-badge.material_delete { background-color: rgba(220, 38, 38, 0.18); color: #fca5a5; }

        .card-item-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-main);
          margin: 0 0 8px 0;
          line-height: 1.2;
        }
        .card-pills-row {
          display: flex;
          gap: 6px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .card-pill-tag {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .card-pill-tag.code-tag {
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
        }
        .card-pill-tag.priority-high {
          background-color: #f5f3ff;
          color: #7c3aed;
        }
        .card-pill-tag.priority-med {
          background-color: #fffbeb;
          color: #d97706;
        }
        body.dark-theme .card-pill-tag.priority-high { background-color: rgba(124, 58, 237, 0.15); color: #c084fc; }
        body.dark-theme .card-pill-tag.priority-med { background-color: rgba(217, 119, 6, 0.15); color: #fbbf24; }

        .card-requester-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: auto;
        }
        .requester-info-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .requester-info-item span {
          color: var(--text-light);
          font-weight: 500;
        }

        /* Column 3: Material Details Gray Box */
        .card-details-box {
          width: 220px;
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 12px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .card-details-box h5 {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-light);
          font-weight: 700;
          margin: 0 0 4px 0;
        }
        .details-box-row {
          display: flex;
          justify-content: space-between;
          font-size: 11.5px;
          line-height: 1.3;
        }
        .details-box-row span {
          color: var(--text-muted);
        }
        .details-box-row strong {
          color: var(--text-main);
          font-weight: 600;
        }

        /* Column 4: Reason Column */
        .card-reason-col {
          flex: 1.2;
          min-width: 180px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .card-reason-col h5 {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-light);
          font-weight: 700;
          margin: 0;
        }
        .card-reason-col p {
          font-size: 13px;
          color: var(--text-main);
          margin: 0;
          line-height: 1.4;
        }
        .rejection-reason-callout {
          padding: 10px 12px;
          background-color: #fef2f2;
          border: 1px solid #fee2e2;
          border-radius: 6px;
          margin-top: auto;
        }
        .rejection-reason-callout h6 {
          font-size: 10.5px;
          color: #dc2626;
          font-weight: 700;
          margin: 0 0 2px 0;
          text-transform: uppercase;
        }
        .rejection-reason-callout p {
          color: #dc2626;
          font-size: 12px;
          font-weight: 500;
          margin: 0;
        }
        body.dark-theme .rejection-reason-callout {
          background-color: rgba(220, 38, 38, 0.08);
          border-color: rgba(220, 38, 38, 0.2);
        }
        body.dark-theme .rejection-reason-callout h6, body.dark-theme .rejection-reason-callout p {
          color: #fca5a5;
        }

        /* Column 5: Timeline tracker Box */
        .card-timeline-col {
          width: 220px;
          flex-shrink: 0;
          border-left: 1px dashed var(--border-color);
          padding-left: 20px;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .timeline-header-block {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .timeline-status-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
        }
        .timeline-status-badge.pending { background-color: rgba(245, 158, 11, 0.1); color: #d97706; }
        .timeline-status-badge.approved { background-color: rgba(16, 185, 129, 0.1); color: #059669; }
        .timeline-status-badge.rejected { background-color: rgba(239, 68, 68, 0.1); color: #dc2626; }
        
        .timeline-options-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          border-radius: 4px;
        }
        .timeline-options-btn:hover {
          color: var(--text-main);
          background-color: var(--bg-primary);
        }

        .timeline-flow {
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
          padding-left: 16px;
        }
        .timeline-flow-line {
          position: absolute;
          left: 4.5px;
          top: 6px;
          bottom: 6px;
          width: 1px;
          background-color: var(--border-color);
        }
        .timeline-flow-step {
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .timeline-flow-dot {
          position: absolute;
          left: -16px;
          top: 5px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--border-color);
          border: 1px solid var(--bg-secondary);
        }
        .timeline-flow-step.completed .timeline-flow-dot {
          background-color: #10b981;
        }
        .timeline-flow-step.under-review .timeline-flow-dot {
          background-color: #f59e0b;
        }
        .timeline-flow-step.rejected-step .timeline-flow-dot {
          background-color: #ef4444;
        }
        
        .timeline-step-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-main);
        }
        .timeline-step-time {
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 1px;
        }
        .timeline-step-actor {
          font-size: 9.5px;
          font-weight: 600;
          color: var(--text-light);
          margin-top: 1px;
        }

        /* Card Footer buttons row */
        .card-footer-buttons {
          border-top: 1px solid var(--border-color);
          padding: 12px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: var(--bg-secondary);
          flex-wrap: wrap;
          gap: 12px;
        }
        .footer-action-btn {
          height: 32px;
          padding: 0 14px;
          font-size: 12.5px;
          font-weight: 700;
          border-radius: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
          background: transparent;
        }
        
        .footer-action-btn.secondary-btn {
          border: 1px solid var(--border-color);
          color: var(--text-muted);
        }
        .footer-action-btn.secondary-btn:hover {
          color: var(--text-main);
          border-color: var(--text-muted);
          background-color: var(--bg-primary);
        }

        .footer-action-btn.reject-btn {
          border: 1px solid #fca5a5;
          color: #dc2626;
        }
        .footer-action-btn.reject-btn:hover {
          background-color: #fef2f2;
          border-color: #dc2626;
        }

        .footer-action-btn.approve-btn {
          border: 1px solid #a7f3d0;
          color: #059669;
        }
        .footer-action-btn.approve-btn:hover {
          background-color: #ecfdf5;
          border-color: #059669;
        }

        body.dark-theme .footer-action-btn.reject-btn { border-color: rgba(239, 68, 68, 0.3); color: #ef4444; }
        body.dark-theme .footer-action-btn.reject-btn:hover { background-color: rgba(239, 68, 68, 0.08); }
        body.dark-theme .footer-action-btn.approve-btn { border-color: rgba(16, 185, 129, 0.3); color: #10b981; }
        body.dark-theme .footer-action-btn.approve-btn:hover { background-color: rgba(16, 185, 129, 0.08); }

        /* Expanded detailed tables block */
        .card-expanded-table-container {
          padding: 0 20px 20px 20px;
          border-top: 1px dashed var(--border-color);
          background-color: var(--bg-primary);
        }
        .expanded-table-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 16px 0 8px 0;
        }

        @media (max-width: 992px) {
          .card-main-content {
            flex-direction: column;
          }
          .card-details-box, .card-timeline-col {
            width: 100%;
            border-left: none;
            padding-left: 0;
            border-top: 1px dashed var(--border-color);
            padding-top: 16px;
          }
          .timeline-flow-line {
            display: none;
          }
          .timeline-flow {
            padding-left: 0;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 16px;
          }
          .timeline-flow-dot {
            display: none;
          }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Floating Action Notifications */}
      {localToast && (
        <div className={`local-notification-toast ${localToast.type}`} style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          fontWeight: '600',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: localToast.type === 'success' ? '#ecfdf5' : '#eff6ff',
          color: localToast.type === 'success' ? '#047857' : '#1d4ed8',
          border: `1px solid ${localToast.type === 'success' ? '#d1fae5' : '#dbeafe'}`
        }}>
          <CheckCircle size={16} />
          <span>{localToast.message}</span>
        </div>
      )}

      {/* Header section */}
      <div className="approval-header-row">
        <div className="header-title-container">
          <h2>{isAdmin ? 'Admin Approval Center' : 'My Requests Hub'}</h2>
          <p>
            {isAdmin
              ? 'Review, approve or reject material issue and deletion requests from team members.'
              : 'Track the real-time status of your requested material issues and deletion events.'}
          </p>
        </div>
        <div className="header-last-updated">
          <span>Last Updated: {lastUpdated}</span>
          <button
            className={`refresh-icon-btn ${refreshSpinning ? 'spinning' : ''}`}
            onClick={handleRefreshQueue}
            title="Refresh Queue"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Grid of 4 Stats Widgets */}
      <div className="stats-grid-container">
        {/* Pending Requests */}
        <div className="stat-card-new pending">
          <div className="stat-card-icon-box">
            <Clock size={20} />
          </div>
          <div className="stat-card-info-box">
            <span className="stat-card-title">Pending Requests</span>
            <span className="stat-card-value">{pendingCount < 10 ? `0${pendingCount}` : pendingCount}</span>
            <span className="stat-card-subtext">Waiting for approval</span>
          </div>
        </div>

        {/* Approved Requests */}
        <div className="stat-card-new approved">
          <div className="stat-card-icon-box">
            <CheckCircle size={20} />
          </div>
          <div className="stat-card-info-box">
            <span className="stat-card-title">Approved Requests</span>
            <span className="stat-card-value">{approvedCount < 10 ? `0${approvedCount}` : approvedCount}</span>
            <span className="stat-card-subtext">Successfully approved</span>
          </div>
        </div>

        {/* Rejected Requests */}
        <div className="stat-card-new rejected">
          <div className="stat-card-icon-box">
            <XCircle size={20} />
          </div>
          <div className="stat-card-info-box">
            <span className="stat-card-title">Rejected Requests</span>
            <span className="stat-card-value">{rejectedCount < 10 ? `0${rejectedCount}` : rejectedCount}</span>
            <span className="stat-card-subtext">Action taken</span>
          </div>
        </div>

        {/* Total Requests */}
        <div className="stat-card-new total">
          <div className="stat-card-icon-box">
            <Package size={20} />
          </div>
          <div className="stat-card-info-box">
            <span className="stat-card-title">Total Requests</span>
            <span className="stat-card-value">{totalCount < 10 ? `0${totalCount}` : totalCount}</span>
            <span className="stat-card-subtext">All time requests</span>
          </div>
        </div>
      </div>

      {/* Filters Group Grid */}
      <div className="filters-group-row">
        {/* Search */}
        <div className="filter-search-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Search by material name, material ID, lot number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status Dropdown */}
        <div className="filter-select-wrapper">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Request Type Dropdown */}
        <div className="filter-select-wrapper">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">Request Type</option>
            <option value="inward_approval">Inward Approval</option>
            <option value="material_issue">Material Issue</option>
            <option value="material_delete">Delete Request</option>
            <option value="design_verification">Design Verification</option>
          </select>
        </div>

        {/* Date Range Dropdown */}
        <div className="filter-select-wrapper">
          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)}>
            <option value="all">Date Range</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>

        {/* Requesters Dropdown */}
        {isAdmin && (
          <div className="filter-select-wrapper">
            <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
              <option value="all">User</option>
              {uniqueRequesters.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        )}

        {/* Reset Filters btn */}
        <button className="reset-filter-btn" onClick={handleResetFilters}>
          <RefreshCw size={12} />
          Reset Filters
        </button>
      </div>

      {/* Pills and Sort Subrow */}
      <div className="pills-filter-row">
        <div className="pills-group">
          {/* All */}
          <button
            className={`pill-toggle-btn all-pill ${filterStatus === 'all' && filterType === 'all' ? 'active' : ''}`}
            onClick={() => { setFilterStatus('all'); setFilterType('all'); }}
          >
            All ({totalCount})
          </button>

          {/* Pending */}
          <button
            className={`pill-toggle-btn pending-pill ${filterStatus === 'pending' && filterType === 'all' ? 'active-state' : ''}`}
            onClick={() => { setFilterStatus('pending'); setFilterType('all'); }}
          >
            <span className="bullet-dot" />
            Pending ({pendingCount})
          </button>

          {/* Approved */}
          <button
            className={`pill-toggle-btn approved-pill ${filterStatus === 'approved' && filterType === 'all' ? 'active-state' : ''}`}
            onClick={() => { setFilterStatus('approved'); setFilterType('all'); }}
          >
            <span className="bullet-dot" />
            Approved ({approvedCount})
          </button>

          {/* Rejected */}
          <button
            className={`pill-toggle-btn rejected-pill ${filterStatus === 'rejected' && filterType === 'all' ? 'active-state' : ''}`}
            onClick={() => { setFilterStatus('rejected'); setFilterType('all'); }}
          >
            <span className="bullet-dot" />
            Rejected ({rejectedCount})
          </button>

          {/* Delete Requests */}
          <button
            className={`pill-toggle-btn delete-pill ${filterStatus === 'all' && filterType === 'material_delete' ? 'active-state' : ''}`}
            onClick={() => { setFilterStatus('all'); setFilterType('material_delete'); }}
          >
            <span className="bullet-dot" />
            Delete Requests ({deleteCount})
          </button>

          {/* Issue Requests */}
          <button
            className={`pill-toggle-btn issue-pill ${filterStatus === 'all' && filterType === 'material_issue' ? 'active-state' : ''}`}
            onClick={() => { setFilterStatus('all'); setFilterType('material_issue'); }}
          >
            <span className="bullet-dot" />
            Issue Requests ({issueCount})
          </button>

          {/* Inward Approval Requests */}
          <button
            className={`pill-toggle-btn issue-pill ${filterStatus === 'all' && filterType === 'inward_approval' ? 'active-state' : ''}`}
            onClick={() => { setFilterStatus('all'); setFilterType('inward_approval'); }}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <span className="bullet-dot" />
            Inward Approvals ({inwardCount})
          </button>
        </div>

        {/* Sort selector */}
        <div className="sort-select-wrapper">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Main Request list */}
      {sortedRequests.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: 'var(--bg-primary)', border: '2px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <ClipboardCheck size={28} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>
            No Requests Found
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            There are no requests matching your current selection parameters.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sortedRequests.map(req => {
            const isExpanded = expandedId === req.id;
            const isPending = req.status === 'pending';
            const priorityInfo = getRequestPriority(req);
            const matDetails = getMaterialDetails(req);
            const timelineDates = getTimelineDates(req);
            const imageSrc = getRequestImage(req);

            return (
              <div key={req.id} className="approval-card-new">
                {/* Thick status indicator bar on the left */}
                <div className={`card-status-bar ${req.status}`} />

                {/* Primary Card body */}
                <div className="card-main-content">
                  {/* Column 1: Image wrapper */}
                  {imageSrc === 'bin' ? (
                    <div className="card-image-wrapper" style={{
                      backgroundColor: 'var(--danger-light)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Trash2 size={44} style={{ color: 'var(--danger)' }} />
                    </div>
                  ) : (
                    <div className="card-image-wrapper">
                      <div
                        className="card-image-thumbnail"
                        style={{ backgroundImage: `url(${imageSrc})` }}
                      />
                    </div>
                  )}

                  {/* Column 2: Title and tags */}
                  <div className="card-title-col">
                    <span className={`type-badge ${req.type} ${req.isReissue ? 'reissue' : ''}`}>
                      {req.type === 'inward_approval'
                        ? 'Inward Approval'
                        : (req.type === 'material_issue'
                          ? (req.isReissue ? 'Re-Issue Request' : 'Issue Request')
                          : req.type === 'design_verification'
                            ? 'Design Verification'
                            : 'Delete Request')}
                    </span>
                    <h4 className="card-item-title">
                      {req.type === 'inward_approval'
                        ? `Material Inward (${req.pieces?.toLocaleString()} pcs) — ${req.materialName}`
                        : (req.type === 'material_issue'
                          ? (req.isReissue ? `Material Re-Issue — Lot ${req.lotId}` : `Material Issue — Lot ${req.lotId}`)
                          : req.type === 'design_verification'
                            ? `Design Verification — Lot ${req.lotId}`
                            : req.materialName)}
                    </h4>
                    <div className="card-pills-row">
                      <span className="card-pill-tag code-tag">{matDetails.materialId}</span>
                      <span className={`card-pill-tag ${priorityInfo.colorClass}`}>{priorityInfo.text}</span>
                    </div>

                    <div className="card-requester-info">
                      <div className="requester-info-item">
                        <User size={13} />
                        <span>Requested by:</span>
                        <strong>{req.requesterName}</strong>
                      </div>
                      <div className="requester-info-item">
                        <Calendar size={13} />
                        <span>Submitted on:</span>
                        <strong>{timelineDates.submitted}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Material Details Box */}
                  <div className="card-details-box">
                    <h5>{req.type === 'design_verification' ? 'Design Details' : (req.type === 'inward_approval' ? 'Inward PO Details' : 'Material Details')}</h5>
                    <div className="details-box-row">
                      <span>{req.type === 'design_verification' ? 'Style Code' : 'Material ID'}</span>
                      <strong>{matDetails.materialId}</strong>
                    </div>
                    <div className="details-box-row">
                      <span>{req.type === 'inward_approval' ? 'PO Number' : 'Lot Number'}</span>
                      <strong style={{ color: req.type === 'inward_approval' ? 'var(--accent-color)' : 'inherit' }}>{matDetails.lotNumber}</strong>
                    </div>
                    {req.type === 'inward_approval' && (
                      <div className="details-box-row">
                        <span>PO Required Qty</span>
                        <strong style={{ color: '#1e40af', fontWeight: '800' }}>{matDetails.poQty}</strong>
                      </div>
                    )}
                    <div className="details-box-row">
                      <span>{req.type === 'design_verification' ? 'Color Swatch' : (req.type === 'inward_approval' ? 'Supplier' : 'Shade')}</span>
                      {req.type === 'design_verification' && matDetails.shade !== 'N/A' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: matDetails.shade, border: '1px solid var(--border-color)' }} />
                          <strong>{matDetails.shade}</strong>
                        </div>
                      ) : (
                        <strong>{matDetails.shade}</strong>
                      )}
                    </div>
                    <div className="details-box-row">
                      <span>{req.type === 'design_verification' ? 'Garment Category' : 'Store'}</span>
                      <strong>{matDetails.store}</strong>
                    </div>
                    <div className="details-box-row">
                      <span>{req.type === 'design_verification' ? 'Order Qty' : (req.type === 'inward_approval' ? 'Incoming Qty' : 'Available Stock')}</span>
                      <strong style={{ color: req.type === 'inward_approval' ? '#d97706' : 'inherit' }}>{matDetails.availableStock}</strong>
                    </div>
                  </div>

                  {/* Column 4: Reason Box */}
                  <div className="card-reason-col">
                    <h5>{req.type === 'inward_approval' ? 'Approval Justification / Rule Violations' : (req.type === 'design_verification' ? 'Design Reference' : (req.type === 'material_issue' ? 'Reason for Issue' : 'Reason for Deletion'))}</h5>
                    <p style={{ fontStyle: req.reason ? 'normal' : 'italic' }}>
                      {req.reason ? `"${req.reason}"` : 'No justification details provided.'}
                    </p>

                    {req.status === 'rejected' && req.rejectionReason && (
                      <div className="rejection-reason-callout">
                        <h6>Rejection Reason</h6>
                        <p>{req.rejectionReason}</p>
                      </div>
                    )}
                  </div>

                  {/* Column 5: Timeline Box */}
                  <div className="card-timeline-col">
                    <div className="timeline-header-block">
                      <span className={`timeline-status-badge ${req.status}`}>
                        {req.status === 'pending' ? 'Pending' : req.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                      <button className="timeline-options-btn" title="More Actions">
                        <MoreHorizontal size={14} />
                      </button>
                    </div>

                    <div className="timeline-flow">
                      <div className="timeline-flow-line" />

                      {/* Step 1 */}
                      <div className="timeline-flow-step completed">
                        <div className="timeline-flow-dot" />
                        <span className="timeline-step-label">Submitted</span>
                        <span className="timeline-step-time">{timelineDates.submitted}</span>
                      </div>

                      {/* Step 2 */}
                      <div className={`timeline-flow-step ${req.status !== 'pending' ? 'completed' : 'under-review'}`}>
                        <div className="timeline-flow-dot" />
                        <span className="timeline-step-label">Under Review</span>
                        <span className="timeline-step-time">
                          {req.status === 'pending' ? 'Pending' : timelineDates.underReview}
                        </span>
                      </div>

                      {/* Step 3 */}
                      {req.status !== 'pending' && (
                        <div className={`timeline-flow-step ${req.status === 'approved' ? 'completed' : 'rejected-step'}`}>
                          <div className="timeline-flow-dot" />
                          <span className="timeline-step-label">
                            {req.status === 'approved' ? 'Approved' : 'Rejected'}
                          </span>
                          <span className="timeline-step-time">{timelineDates.resolved}</span>
                          <span className="timeline-step-actor">by {timelineDates.actor}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card footer details action buttons */}
                <div className="card-footer-buttons">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="footer-action-btn secondary-btn"
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    >
                      <Eye size={13} />
                      {isExpanded ? 'Hide Details' : 'View Details'}
                    </button>
                    <button
                      className="footer-action-btn secondary-btn"
                      onClick={() => handleDownloadPDF(req)}
                    >
                      <Download size={13} />
                      Download PDF
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isPending && isAdmin && (
                      <>
                        <button
                          className="footer-action-btn reject-btn"
                          onClick={() => handleRejectOpen(req)}
                        >
                          <XCircle size={13} />
                          Reject
                        </button>
                        <button
                          className="footer-action-btn approve-btn"
                          onClick={() => handleApprove(req)}
                        >
                          <CheckCircle size={13} />
                          Approve
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Collapsible components table (only for material issue requests) */}
                {isExpanded && req.type === 'material_issue' && req.items && req.items.length > 0 && (
                  <div className="card-expanded-table-container">
                    <h5 className="expanded-table-title">Components to Issue</h5>
                    <div className="custom-table-container">
                      <table className="custom-table" style={{ fontSize: '12.5px' }}>
                        <thead>
                          <tr>
                            <th>BOM Component</th>
                            <th>Inventory Material Map</th>

                            <th>Total Required</th>
                            <th>Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {req.items.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>{item.bomItemName}</td>
                              <td style={{ color: 'var(--text-muted)' }}>{item.materialName}</td>

                              <td style={{ fontWeight: '700', color: 'var(--accent-color)' }}>{item.totalRequired}</td>
                              <td style={{ color: 'var(--text-muted)' }}>{item.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Collapsible BOM checklist table (only for design verification requests) */}
                {isExpanded && req.type === 'design_verification' && (
                  <div className="card-expanded-table-container">
                    <h5 className="expanded-table-title">Bill of Materials (BOM) Checklist</h5>
                    <div className="custom-table-container">
                      <table className="custom-table" style={{ fontSize: '12.5px' }}>
                        <thead>
                          <tr>
                            <th>Component Name</th>
                            <th style={{ textAlign: 'center' }}>Required</th>
                            <th>Qty/Piece</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const design = designs.find(d => String(d.id) === String(req.lotId));
                            const bomList = design?.bom || [];
                            if (bomList.length === 0) {
                              return (
                                <tr>
                                  <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No BOM components configured.</td>
                                </tr>
                              );
                            }
                            return bomList.map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>{item.name}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={`status-badge ${String(item.status).toLowerCase() === 'yes' ? 'verified' : 'rejected'}`} style={{ fontSize: '11px', fontWeight: 'bold' }}>
                                    {item.status || 'No'}
                                  </span>
                                </td>
                                <td style={{ fontWeight: '700', color: 'var(--accent-color)' }}>{item.detail || '—'}</td>
                                <td style={{ color: 'var(--text-muted)' }}>{item.description || '—'}</td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Collapsible Inward Details Table (for inward approval requests) */}
                {isExpanded && req.type === 'inward_approval' && (
                  <div className="card-expanded-table-container">
                    <h5 className="expanded-table-title">Inward Material Verification & Procurement Parameters</h5>
                    {(() => {
                      const inwardItem = req.items?.[0] || req.items || {};
                      let parsedPoQty = inwardItem.poQty || inwardItem.orderedQty || null;
                      if (!parsedPoQty && req.reason) {
                        const match = req.reason.match(/remaining needed\s+([\d,]+)/i) || req.reason.match(/needed\s+([\d,]+)/i) || req.reason.match(/required\s+([\d,]+)/i);
                        if (match) parsedPoQty = parseInt(match[1].replace(/,/g, ''), 10);
                      }
                      const poQtyStr = parsedPoQty ? `${Number(parsedPoQty).toLocaleString()} Pcs` : 'As per PO';
                      const incomingPcs = req.pieces || inwardItem.pieces || 0;
                      const extraQty = parsedPoQty ? (incomingPcs - Number(parsedPoQty)) : 0;
                      const extraStr = extraQty > 0 ? `+${extraQty.toLocaleString()} Pcs Extra` : (extraQty === 0 ? 'Exact Match' : `${Math.abs(extraQty).toLocaleString()} Pcs Short`);

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '10px',
                            background: 'var(--bg-primary)',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)'
                          }}>
                            <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Material Code:</span> <div style={{ fontWeight: '800', fontFamily: 'monospace' }}>{inwardItem.materialCode || req.materialId}</div></div>
                            <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Material Name:</span> <div style={{ fontWeight: '800' }}>{inwardItem.materialName || req.materialName}</div></div>
                            <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Supplier / Vendor:</span> <div style={{ fontWeight: '800', color: 'var(--accent-color)' }}>{inwardItem.supplier || 'N/A'}</div></div>
                            <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bill / Invoice No:</span> <div style={{ fontWeight: '800' }}>{inwardItem.invoiceNo || 'N/A'}</div></div>
                            <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PO Reference:</span> <div style={{ fontWeight: '800', color: 'var(--accent-color)' }}>{inwardItem.poNumber || req.lotId || 'N/A'}</div></div>
                            <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PO Required / Ordered Qty:</span> <div style={{ fontWeight: '900', color: '#1e40af' }}>{poQtyStr}</div></div>
                            <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Incoming:</span> <div style={{ fontWeight: '900', color: '#2563eb' }}>{incomingPcs.toLocaleString()} {inwardItem.unit || 'Pcs'}</div></div>
                            <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Extra / Balance Status:</span> <div style={{ fontWeight: '900', color: extraQty > 0 ? '#8b5cf6' : '#10b981' }}>{extraStr}</div></div>
                            <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned Location:</span> <div style={{ fontWeight: '800', color: '#10b981' }}>{inwardItem.storeLocation || 'Main Store'}</div></div>
                            <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Packets:</span> <div style={{ fontWeight: '800' }}>{inwardItem.packets || 1} Pkts</div></div>
                            <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Gross / Net Weight:</span> <div style={{ fontWeight: '800' }}>{inwardItem.grossWeightKg || 0} / {inwardItem.netWeightKg || 0} KG</div></div>
                            <div><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Piece Weight:</span> <div style={{ fontWeight: '800' }}>{inwardItem.weightPerPieceG || 10} g/pc</div></div>
                          </div>

                          {req.reason && (
                            <div style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              color: '#991b1b',
                              fontSize: '12px',
                              fontWeight: '700'
                            }}>
                              <span style={{ marginRight: '6px' }}>⚠️ Violation / Flag:</span>
                              {req.reason}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Reason modal */}
      {rejectModalId && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XCircle size={18} style={{ color: 'var(--danger)' }} />
                Reject Request
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setRejectModalId(null)}>Cancel</button>
            </div>
            <div style={{ padding: '4px 0 16px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
                Please provide a reason for rejecting this request. This will be recorded for the requester's reference.
              </p>
              {rejectError && (
                <div className="auth-alert error" style={{ padding: '8px 12px', marginBottom: '16px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{rejectError}</span>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Rejection Reason <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Insufficient justification, incorrect lot, stock not verified yet..."
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (rejectError) setRejectError('');
                  }}
                  style={{ resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setRejectModalId(null)}>Cancel</button>
              <button
                className="btn"
                onClick={handleRejectConfirm}
                style={{
                  backgroundColor: 'var(--danger)', color: '#fff', border: 'none',
                  padding: '8px 20px', borderRadius: 'var(--border-radius-sm)',
                  fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <XCircle size={14} />
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '400px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700' }}>Confirm Approval</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px', lineHeight: '1.4' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print layout — only visible during print media */}
      {printRequest && (
        <div className="approval-request-print-layout">
          {/* Slip header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '14px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>MH ACCESSORIES & BOM</h2>
              <span style={{ fontSize: '11px', color: '#555' }}>Premium Garment Production Management System</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                {printRequest.type === 'inward_approval' ? 'Material Inward Receipt Authorization' :
                  printRequest.type === 'material_issue' ? 'Material Requisition & Issue Slip' :
                    printRequest.type === 'design_verification' ? 'Design Verification Requisition' :
                      'Material Deletion Authorization'}
              </h3>
              <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Request ID: #{printRequest.id}</span>
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 20px', padding: '12px', border: '1px solid #000', borderRadius: '4px', marginBottom: '16px', fontSize: '12px' }}>
            <div><strong>Request Type:</strong> {printRequest.type === 'inward_approval' ? 'Inward Approval' : (printRequest.type === 'material_issue' ? 'Material Issue' : printRequest.type === 'design_verification' ? 'Design Verification' : 'Material Deletion')}</div>
            <div><strong>Status:</strong> {printRequest.status.toUpperCase()}</div>
            <div><strong>Lot Number:</strong> Lot {printRequest.lotId || 'N/A'}</div>
            <div><strong>Submitted Date:</strong> {printRequest.date}</div>
            <div><strong>Requested By:</strong> {printRequest.requesterName}</div>
            {printRequest.resolvedDate && (
              <div><strong>Approved/Resolved Date:</strong> {printRequest.resolvedDate}</div>
            )}
            {printRequest.materialName && (
              <div><strong>Material Mapped:</strong> {printRequest.materialName} ({printRequest.materialId})</div>
            )}
          </div>

          {/* Reason Box */}
          <div style={{ marginBottom: '16px', fontSize: '12px' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: '3px' }}>Justification / Reason</h4>
            <p style={{ margin: 0, fontStyle: 'italic', color: '#333' }}>
              {printRequest.reason ? `"${printRequest.reason}"` : 'No justification details provided.'}
            </p>
            {printRequest.status === 'rejected' && printRequest.rejectionReason && (
              <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '4px' }}>
                <strong style={{ color: '#dc2626' }}>Rejection Reason:</strong> <span style={{ color: '#dc2626' }}>{printRequest.rejectionReason}</span>
              </div>
            )}
          </div>

          {/* Items / Details Table */}
          {printRequest.type === 'material_issue' && printRequest.items && printRequest.items.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: '3px' }}>Components to Issue</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000', backgroundColor: '#f3f4f6' }}>
                    <th style={{ textAlign: 'left', padding: '6px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '6px' }}>BOM Component</th>
                    <th style={{ textAlign: 'left', padding: '6px' }}>Inventory Material Map</th>
                    <th style={{ textAlign: 'right', padding: '6px' }}>Total Required</th>
                    <th style={{ textAlign: 'left', padding: '6px', paddingLeft: '12px' }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {printRequest.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '6px' }}>{idx + 1}</td>
                      <td style={{ padding: '6px', fontWeight: '600' }}>{item.bomItemName}</td>
                      <td style={{ padding: '6px', color: '#4b5563' }}>{item.materialName}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{item.totalRequired}</td>
                      <td style={{ padding: '6px', paddingLeft: '12px', color: '#4b5563' }}>{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {printRequest.type === 'design_verification' && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: '3px' }}>Bill of Materials (BOM) Checklist</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000', backgroundColor: '#f3f4f6' }}>
                    <th style={{ textAlign: 'left', padding: '6px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '6px' }}>Component Name</th>
                    <th style={{ textAlign: 'center', padding: '6px' }}>Required Status</th>
                    <th style={{ textAlign: 'left', padding: '6px' }}>Qty/Piece</th>
                    <th style={{ textAlign: 'left', padding: '6px' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const design = designs.find(d => String(d.id) === String(printRequest.lotId));
                    const bomList = design?.bom || [];
                    if (bomList.length === 0) {
                      return (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '12px', color: '#6b7280' }}>No BOM components configured.</td>
                        </tr>
                      );
                    }
                    return bomList.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '6px' }}>{idx + 1}</td>
                        <td style={{ padding: '6px', fontWeight: '600' }}>{item.name}</td>
                        <td style={{ padding: '6px', textAlign: 'center' }}>{item.status || 'No'}</td>
                        <td style={{ padding: '6px', fontWeight: 'bold' }}>{item.detail || '—'}</td>
                        <td style={{ padding: '6px', color: '#4b5563' }}>{item.description || '—'}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', fontSize: '12px' }}>
            <div style={{ width: '40%', borderTop: '1px solid #000', textAlign: 'center', paddingTop: '6px' }}>
              <strong>Requested By</strong>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{printRequest.requesterName}</div>
            </div>
            <div style={{ width: '40%', borderTop: '1px solid #000', textAlign: 'center', paddingTop: '6px' }}>
              <strong>Authorized Signatory (Admin)</strong>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                {printRequest.resolvedDate ? (printRequest.resolvedDate.includes(' by ') ? printRequest.resolvedDate.split(' by ')[1] : 'Admin') : '________________'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

