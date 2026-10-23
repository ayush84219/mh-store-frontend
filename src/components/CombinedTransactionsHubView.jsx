import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getBackendUrl } from '../utils/api';
import {
  Search, Filter, Calendar, User, FileText, Truck, Download, Printer,
  Ban, CheckCircle2, AlertTriangle, RefreshCw, X, Eye, ChevronRight,
  Layers, QrCode, Tag, ArrowRight, ShieldAlert, Sparkles, Building2,
  Package, Clock, Undo2, Check, ExternalLink, Hash, AlertCircle, FileSpreadsheet
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Modal component for cancelling any transaction
function CancelTransactionModal({
  isOpen,
  onClose,
  transaction,
  currentUser,
  onConfirmCancel
}) {
  const [reason, setReason] = useState('Wrong Entry / Punching Mistake');
  const [remarks, setRemarks] = useState('');
  const [cancelledBy, setCancelledBy] = useState(currentUser?.name || 'Store Incharge');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('Wrong Entry / Punching Mistake');
      setRemarks('');
      setCancelledBy(currentUser?.name || 'Store Incharge');
      setConfirmed(false);
      setError('');
    }
  }, [isOpen, currentUser]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirmed) {
      setError('Please tick the confirmation checkbox to authorize cancellation.');
      return;
    }
    if (!remarks.trim()) {
      setError('Please provide detailed cancellation remarks / audit reason.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onConfirmCancel({
        transactionType: transaction.typeKey,
        transactionRef: transaction.refNo,
        reason,
        remarks: remarks.trim(),
        cancelledBy: cancelledBy.trim(),
        meta: {
          lotNo: transaction.lotNo,
          vendor: transaction.partyName,
          totalQty: transaction.totalQty,
          date: transaction.date
        }
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to cancel transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #fee2e2',
        overflow: 'hidden',
        animation: 'modalSlideUp 0.2s ease-out'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Ban size={22} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Cancel Transaction</h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', opacity: 0.9 }}>
                Official Void & Cancellation Form (Audit Logged)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Transaction Summary Card */}
        <div style={{ padding: '16px 24px', background: '#fef2f2', borderBottom: '1px solid #fee2e2' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12.5px' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Transaction Ref</span>
              <strong style={{ color: '#b91c1c', fontSize: '14px' }}>{transaction.refNo}</strong>
              <span style={{
                marginLeft: '8px',
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: '#fee2e2',
                color: '#991b1b',
                fontWeight: '700'
              }}>
                {transaction.typeLabel}
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Lot / Style</span>
              <span style={{ color: '#0f172a', fontWeight: '600' }}>{transaction.lotNo || 'N/A'} {transaction.style ? `(${transaction.style})` : ''}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Party / Vendor</span>
              <span style={{ color: '#0f172a', fontWeight: '600' }}>{transaction.partyName || '—'}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Quantity / Value</span>
              <span style={{ color: '#0f172a', fontWeight: '700' }}>
                {transaction.totalQty ? `${transaction.totalQty} ${transaction.unit || 'units'}` : '—'}
                {transaction.totalAmount ? ` (₹${Number(transaction.totalAmount).toLocaleString()})` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Cancellation Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          {error && (
            <div style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Reason Select */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
              Cancellation Reason Category <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: '600',
                color: '#0f172a',
                outline: 'none',
                background: '#ffffff',
                boxSizing: 'border-box'
              }}
            >
              <option value="Wrong Entry / Punching Mistake">Wrong Entry / Punching Mistake</option>
              <option value="Order Cancelled by Buyer / Party">Order Cancelled by Buyer / Party</option>
              <option value="Fabric / Accessory Material Shortage">Fabric / Accessory Material Shortage</option>
              <option value="Supplier Delivery Refused / Returned">Supplier Delivery Refused / Returned</option>
              <option value="Quality Defect / Inspection Failed">Quality Defect / Inspection Failed</option>
              <option value="Duplicate Order / Duplicate PO">Duplicate Order / Duplicate PO</option>
              <option value="Incorrect Rate / Commercial Revision">Incorrect Rate / Commercial Revision</option>
              <option value="Other Audit Cancellation">Other Audit Cancellation</option>
            </select>
          </div>

          {/* Remarks Textarea */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
              Detailed Cancellation Audit Remarks <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Explain why this transaction is being cancelled (required for management audit)..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13px',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Cancelled By & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                Authorized By / Operator
              </label>
              <input
                type="text"
                value={cancelledBy}
                onChange={(e) => setCancelledBy(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                Cancellation Timestamp
              </label>
              <input
                type="text"
                disabled
                value={new Date().toLocaleString('en-GB')}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '12.5px',
                  color: '#64748b',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '20px'
          }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                style={{ marginTop: '3px', cursor: 'pointer', width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '12px', color: '#881337', fontWeight: '600', lineHeight: 1.4 }}>
                I confirm that this transaction ({transaction.refNo}) should be permanently marked as <strong>CANCELLED</strong> in the database and audit trail.
              </span>
            </label>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting || !confirmed}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                background: confirmed ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : '#cbd5e1',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: confirmed ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: confirmed ? '0 4px 12px rgba(220, 38, 38, 0.25)' : 'none'
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={15} className="spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <>
                  <Ban size={15} />
                  <span>Confirm & Cancel Transaction</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal for viewing and printing formatted Bill / Voucher ─────────────────
function BillVoucherModal({ isOpen, onClose, transaction, currencySymbol = '₹' }) {
  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 70, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text('MH APPARELS & ACCESSORIES', 40, 32);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text('Plot #42, Industrial Area, Phase-II, Garments Zone | Store & Procurement Dept', 40, 48);

      // Doc Type
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(254, 240, 138);
      const title = transaction.typeKey === 'rgp' ? 'RETURNABLE GATE PASS' :
                    transaction.typeKey === 'po' ? 'PURCHASE ORDER VOUCHER' :
                    transaction.typeKey === 'zip' ? 'ZIPPER WORK ORDER' :
                    transaction.typeKey === 'dori' ? 'DORI ACCESSORY ORDER' : 'TRANSACTION BILL';
      doc.text(title, pageWidth - 40, 35, { align: 'right' });

      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(`REF: ${transaction.refNo}`, pageWidth - 40, 52, { align: 'right' });

      // If Cancelled Watermark
      if (transaction.isCancelled) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(50);
        doc.setTextColor(239, 68, 68);
        doc.text('CANCELLED / VOID', pageWidth / 2, 380, { align: 'center', angle: 45 });
      }

      // Metadata Table
      const metaY = 90;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('PARTY / SUPPLIER DETAILS:', 40, metaY);
      doc.text('ORDER & DISPATCH DETAILS:', pageWidth / 2 + 20, metaY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.text(transaction.partyName || '—', 40, metaY + 16);
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Contact / Vendor Master: Active`, 40, metaY + 30);
      doc.text(`Delivery Location: Main Store / Receiving Dock`, 40, metaY + 44);

      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`Lot Number: ${transaction.lotNo || 'General'}`, pageWidth / 2 + 20, metaY + 16);
      doc.text(`Garment / Style: ${transaction.style || '—'}`, pageWidth / 2 + 20, metaY + 30);
      doc.text(`Issue Date: ${transaction.date || '—'}`, pageWidth / 2 + 20, metaY + 44);
      doc.text(`Raised By: ${transaction.operator || 'Store Staff'}`, pageWidth / 2 + 20, metaY + 58);

      // Line Items
      const tableHeaders = [['#', 'Item Description / Spec', 'Placement / Shade', 'Quantity', 'Rate', 'Total Amount']];
      const tableRows = (transaction.items && transaction.items.length > 0) ? transaction.items.map((it, idx) => [
        idx + 1,
        it.name || it.item || it.description || it.materialName || '—',
        it.placement || it.type || it.color || '—',
        `${it.qty || it.quantity || it.pieces || 0} ${it.unit || transaction.unit || ''}`,
        it.rate ? `₹${Number(it.rate).toFixed(2)}` : '—',
        it.total ? `₹${Number(it.total).toFixed(2)}` : (it.rate && it.qty ? `₹${(it.rate * it.qty).toFixed(2)}` : '—')
      ]) : [
        [1, transaction.style || 'General Component', '—', `${transaction.totalQty || 1} ${transaction.unit || 'units'}`, '—', '—']
      ];

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: metaY + 75,
        styles: { fontSize: 8.5, cellPadding: 6 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      const finalY = doc.lastAutoTable.finalY || 350;

      // Summary Box
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Quantity: ${transaction.totalQty} ${transaction.unit || 'units'}`, 40, finalY + 25);
      if (transaction.totalAmount) {
        doc.text(`Total Amount: ₹${Number(transaction.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - 40, finalY + 25, { align: 'right' });
      }

      // Signatures
      const sigY = Math.max(finalY + 90, 700);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);

      doc.line(40, sigY, 150, sigY);
      doc.text('Prepared By', 40, sigY + 12);

      doc.line(pageWidth / 2 - 50, sigY, pageWidth / 2 + 50, sigY);
      doc.text('Store / Gate Verified', pageWidth / 2 - 50, sigY + 12);

      doc.line(pageWidth - 150, sigY, pageWidth - 40, sigY);
      doc.text('Authorized Signatory', pageWidth - 150, sigY + 12);

      doc.save(`${transaction.refNo}_Bill.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
      alert('Error generating PDF: ' + err.message);
    }
  };

  const isCancelled = transaction.isCancelled;
  const items = transaction.items || [];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#f1f5f9',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '880px',
        maxHeight: '94vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #cbd5e1'
      }}>
        {/* Top Control Bar (Screen only, hidden on print) */}
        <div className="no-print" style={{
          padding: '12px 20px',
          background: '#1e293b',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #334155'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} color="#38bdf8" />
            <div>
              <strong style={{ fontSize: '15px' }}>Official Bill & Voucher</strong>
              <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px' }}>
                Ref: {transaction.refNo} ({transaction.typeLabel})
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: '#0284c7',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Printer size={15} />
              <span>Print Bill</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #475569',
                background: '#334155',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Download size={15} />
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '8px'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* The Printable A4 Sheet Body */}
        <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
          <div id="printable-bill" style={{
            background: '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            padding: '36px',
            color: '#0f172a',
            position: 'relative',
            border: '1px solid #e2e8f0',
            maxWidth: '800px',
            margin: '0 auto',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {/* Watermark if Cancelled */}
            {isCancelled && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-35deg)',
                fontSize: '60px',
                fontWeight: '900',
                color: 'rgba(239, 68, 68, 0.16)',
                border: '6px solid rgba(239, 68, 68, 0.25)',
                padding: '16px 48px',
                borderRadius: '16px',
                pointerEvents: 'none',
                letterSpacing: '4px',
                zIndex: 10
              }}>
                CANCELLED / VOID
              </div>
            )}

            {/* Bill Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '2.5px solid #0f172a',
              paddingBottom: '16px',
              marginBottom: '20px'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px' }}>
                  MH APPARELS & ACCESSORIES
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>
                  Plot #42, Industrial Area Phase-II, Garments Zone | GSTIN: 07AAAAA0000A1Z5
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                  Phone: +91 98765 43210 | Email: store@mhapparels.com
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  background: isCancelled ? '#fee2e2' : '#0284c7',
                  color: isCancelled ? '#991b1b' : '#ffffff',
                  fontSize: '11px',
                  fontWeight: '900',
                  padding: '4px 10px',
                  borderRadius: '5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {transaction.typeKey === 'rgp' ? 'RETURNABLE GATE PASS' :
                   transaction.typeKey === 'po' ? 'PURCHASE ORDER BILL' :
                   transaction.typeKey === 'zip' ? 'ZIPPER WORK ORDER' :
                   transaction.typeKey === 'dori' ? 'DORI ACCESSORY ORDER' : 'OFFICIAL BILL VOUCHER'}
                </span>
                <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: '900', fontFamily: 'monospace', color: '#0f172a' }}>
                  {transaction.refNo}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                  Date: <strong>{transaction.date || '—'}</strong>
                </div>
              </div>
            </div>

            {/* Billing / Vendor Details Two-Column Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '20px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px 18px',
              marginBottom: '20px',
              fontSize: '12px'
            }}>
              <div>
                <span style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>
                  PARTY / VENDOR DETAILS
                </span>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginTop: '3px' }}>
                  {transaction.partyName || '—'}
                </div>
                <div style={{ color: '#475569', marginTop: '2px' }}>
                  Authorized Supplier & Fabricator
                </div>
                <div style={{ color: '#64748b', marginTop: '2px' }}>
                  Delivery Destination: <strong>Main Store / Packing Dept</strong>
                </div>
              </div>

              <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '18px' }}>
                <span style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>
                  ORDER SPECIFICATIONS
                </span>
                <div style={{ marginTop: '3px' }}>
                  <strong>Lot Number:</strong> <span style={{ color: '#0284c7', fontWeight: '700' }}>{transaction.lotNo || 'General'}</span>
                </div>
                <div style={{ marginTop: '2px' }}>
                  <strong>Garment / Style:</strong> {transaction.style || '—'}
                </div>
                <div style={{ marginTop: '2px' }}>
                  <strong>Fabric / Quality:</strong> {transaction.fabric || '—'}
                </div>
                <div style={{ marginTop: '2px' }}>
                  <strong>Issuer / Supervisor:</strong> {transaction.operator || 'Store Incharge'}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ marginBottom: '20px' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px',
                border: '1px solid #cbd5e1'
              }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#ffffff', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px', width: '35px' }}>#</th>
                    <th style={{ padding: '8px 10px' }}>Item Name & Description</th>
                    <th style={{ padding: '8px 10px' }}>Placement / Shade</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Quantity</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? (
                    items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '8px 10px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a' }}>
                          {it.name || it.item || it.description || it.materialName || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#475569' }}>
                          {it.placement || it.type || it.color || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800' }}>
                          {it.qty || it.quantity || it.pieces || 0} {it.unit || transaction.unit || ''}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                          {it.rate ? `₹${Number(it.rate).toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                          {it.total ? `₹${Number(it.total).toFixed(2)}` : (it.rate && it.qty ? `₹${(it.rate * it.qty).toFixed(2)}` : '—')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr style={{ background: '#ffffff' }}>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>1</td>
                      <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a' }}>
                        {transaction.style || 'Material Line Item'}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#475569' }}>—</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800' }}>
                        {transaction.totalQty} {transaction.unit || 'units'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>—</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800' }}>
                        {transaction.totalAmount ? `₹${Number(transaction.totalAmount).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Amount in Words */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderTop: '1px solid #cbd5e1',
              paddingTop: '12px',
              marginBottom: '30px'
            }}>
              <div style={{ fontSize: '11px', color: '#64748b', maxWidth: '420px' }}>
                <strong style={{ color: '#0f172a' }}>Terms & Declaration:</strong>
                <p style={{ margin: '2px 0 0', lineHeight: 1.4 }}>
                  Goods must strictly conform to approved production samples. Material received subject to quality inspection at inward gate.
                </p>
              </div>

              <div style={{ textAlign: 'right', minWidth: '220px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                  <span>Total Ordered Quantity:</span>
                  <strong>{transaction.totalQty} {transaction.unit || 'units'}</strong>
                </div>
                {transaction.totalAmount > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    fontWeight: '900',
                    color: '#0f172a',
                    borderTop: '1.5px solid #0f172a',
                    paddingTop: '6px',
                    marginTop: '4px'
                  }}>
                    <span>Grand Total:</span>
                    <span style={{ color: '#0284c7' }}>₹{Number(transaction.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Three Signature Boxes */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '24px',
              paddingTop: '20px',
              borderTop: '1px dashed #cbd5e1',
              textAlign: 'center',
              fontSize: '11px'
            }}>
              <div>
                <div style={{ height: '36px' }}></div>
                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontWeight: '700', color: '#334155' }}>
                  Prepared By ({transaction.operator || 'Staff'})
                </div>
              </div>

              <div>
                <div style={{ height: '36px' }}></div>
                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontWeight: '700', color: '#334155' }}>
                  Store / Security Verified
                </div>
              </div>

              <div>
                <div style={{ height: '36px' }}></div>
                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontWeight: '800', color: '#0f172a' }}>
                  Authorized Signatory
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="no-print" style={{
          padding: '12px 20px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 18px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal for viewing complete details & linked scanner logs
function TransactionDetailsModal({ isOpen, onClose, transaction, relatedScans, onCancelClick, onRestoreClick, onOpenBill }) {
  if (!isOpen || !transaction) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99990,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '90vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: transaction.badgeBg || '#e2e8f0',
                color: transaction.badgeColor || '#334155',
                fontSize: '11px',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}>
                {transaction.typeLabel}
              </span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
                {transaction.refNo}
              </h3>
              {transaction.isCancelled && (
                <span style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  ⛔ CANCELLED
                </span>
              )}
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Created: {transaction.date || '—'} | Lot: {transaction.lotNo || 'Direct Entry'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Cancellation Notice if cancelled */}
          {transaction.isCancelled && (
            <div style={{
              background: '#fef2f2',
              border: '1.5px solid #fecdd3',
              borderRadius: '10px',
              padding: '14px 18px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: '800', marginBottom: '6px' }}>
                <Ban size={18} />
                <span>THIS TRANSACTION WAS CANCELLED</span>
              </div>
              <div style={{ fontSize: '13px', color: '#7f1d1d', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <div><strong>Reason:</strong> {transaction.cancellationReason || 'Standard Cancellation'}</div>
                <div><strong>Cancelled By:</strong> {transaction.cancelledBy || 'Admin'}</div>
                <div><strong>Cancelled At:</strong> {transaction.cancelledAt ? new Date(transaction.cancelledAt).toLocaleString('en-GB') : '—'}</div>
                <div><strong>Remarks:</strong> {transaction.cancellationRemarks || '—'}</div>
              </div>
            </div>
          )}

          {/* Overview Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginBottom: '24px',
            background: '#f8fafc',
            padding: '14px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Party / Vendor</span>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{transaction.partyName || '—'}</div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Garment / Style</span>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{transaction.style || transaction.garmentType || '—'}</div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Fabric Quality</span>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{transaction.fabric || '—'}</div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Total Quantity</span>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0284c7', marginTop: '2px' }}>
                {transaction.totalQty ? `${transaction.totalQty} ${transaction.unit || 'units'}` : '—'}
              </div>
            </div>
          </div>

          {/* Detailed Item List / Breakdown */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={16} color="#0284c7" />
              <span>Material & Item Breakdown</span>
            </h4>
            {transaction.items && transaction.items.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '8px 10px' }}>#</th>
                    <th style={{ padding: '8px 10px' }}>Item / Description</th>
                    <th style={{ padding: '8px 10px' }}>Placement / Type</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Quantity</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: '600' }}>{it.name || it.item || it.description || it.materialName || '—'}</td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{it.placement || it.type || it.color || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>{it.qty || it.quantity || it.pieces || 0} {it.unit || ''}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{it.rate ? `₹${it.rate}` : '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                        {it.total ? `₹${Number(it.total).toLocaleString()}` : (it.rate && it.qty ? `₹${(it.rate * it.qty).toLocaleString()}` : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '12.5px' }}>
                No line items or raw entries recorded for this document.
              </div>
            )}
          </div>

          {/* Scanner Timeline Checkpoints */}
          <div>
            <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <QrCode size={16} color="#8b5cf6" />
              <span>Linked Scanner Checkpoints & Gate Logs ({relatedScans.length})</span>
            </h4>
            {relatedScans.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {relatedScans.map((sc, sIdx) => (
                  <div key={sIdx} style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#faf5ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12.5px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        background: '#e9d5ff',
                        color: '#6b21a8',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontWeight: '800',
                        fontSize: '11px',
                        textTransform: 'uppercase'
                      }}>
                        {sc.scan_type || 'Scan Checkpoint'}
                      </span>
                      <strong style={{ color: '#0f172a' }}>{sc.material_name || sc.lot_number}</strong>
                      <span style={{ color: '#64748b' }}>({sc.quantity || 0} pcs)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#64748b', fontSize: '12px' }}>
                      <span><strong>Officer:</strong> {sc.person_name || 'Security'}</span>
                      <span><strong>Supplier:</strong> {sc.supplier_name || '—'}</span>
                      <span style={{ color: '#0f172a', fontWeight: '600' }}>
                        {sc.scanned_at ? new Date(sc.scanned_at).toLocaleString('en-GB') : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', color: '#94a3b8', fontSize: '12.5px', textAlign: 'center' }}>
                No security / QR scanner events recorded yet for this reference.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            {!transaction.isCancelled ? (
              <button
                onClick={() => {
                  onClose();
                  onCancelClick(transaction);
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1.5px solid #f87171',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Ban size={15} />
                <span>Cancel This Transaction</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onRestoreClick(transaction);
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1.5px solid #86efac',
                  background: '#f0fdf4',
                  color: '#15803d',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Undo2 size={15} />
                <span>Restore / Un-cancel</span>
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                if (typeof onOpenBill === 'function') {
                  onOpenBill(transaction);
                }
              }}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                border: '1.5px solid #0284c7',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
              }}
              title="Open Official Printable Bill Voucher"
            >
              <FileText size={15} />
              <span>View Bill</span>
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Combined Transactions Hub Component ─────────────────────────────────
export default function CombinedTransactionsHubView({ currentUser = null, currencySymbol = '₹' }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Raw data from API
  const [pos, setPos] = useState([]);
  const [rgps, setRgps] = useState([]);
  const [dooriOrders, setDooriOrders] = useState([]);
  const [zipOrders, setZipOrders] = useState([]);
  const [scans, setScans] = useState([]);
  const [cancellations, setCancellations] = useState([]);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all, rgp, po, dori, zip, scan, cancelled
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, cancelled
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected modals
  const [selectedTxForCancel, setSelectedTxForCancel] = useState(null);
  const [selectedTxForDetails, setSelectedTxForDetails] = useState(null);
  const [selectedTxForBill, setSelectedTxForBill] = useState(null);
  const [cancellationNotice, setCancellationNotice] = useState(null);

  // Fetch all combined data
  const fetchAllData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/transactions/all-combined`);
      if (res.ok) {
        const data = await res.json();
        setPos(data.pos || []);
        setRgps(data.rgps || []);
        setDooriOrders(data.dooriOrders || []);
        setZipOrders(data.zipOrders || []);
        setScans(data.scans || []);
        setCancellations(data.cancellations || []);
      } else {
        // Fallback to individual endpoints if combined route has issue
        const [poRes, rgpRes, doriRes, zipRes, scanRes, cancelRes] = await Promise.all([
          fetch(`${backendUrl}/api/pos`).then(r => r.json()).catch(() => []),
          fetch(`${backendUrl}/api/rgp`).then(r => r.json()).catch(() => []),
          fetch(`${backendUrl}/api/doori-orders`).then(r => r.json()).catch(() => []),
          fetch(`${backendUrl}/api/cutting-headers`).then(r => r.json()).catch(() => []),
          fetch(`${backendUrl}/api/scans`).then(r => r.json()).catch(() => []),
          fetch(`${backendUrl}/api/transactions/cancellations`).then(r => r.json()).catch(() => [])
        ]);
        setPos(Array.isArray(poRes) ? poRes : []);
        setRgps(Array.isArray(rgpRes) ? rgpRes : []);
        setDooriOrders(Array.isArray(doriRes) ? doriRes : []);
        setZipOrders(Array.isArray(zipRes) ? zipRes : []);
        setScans(Array.isArray(scanRes) ? scanRes : []);
        setCancellations(Array.isArray(cancelRes) ? cancelRes : []);
      }
    } catch (err) {
      console.error('Failed to fetch combined transactions:', err);
      setError('Could not connect to database. Please check backend server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Map cancellations into a lookup map
  const cancellationMap = useMemo(() => {
    const map = new Map();
    cancellations.forEach(c => {
      const key = `${c.transactionType}_${String(c.transactionRef).trim().toLowerCase()}`;
      map.set(key, c);
    });
    return map;
  }, [cancellations]);

  // Normalize all transactions into unified format
  const normalizedTransactions = useMemo(() => {
    const list = [];

    // 1. Returnable Gate Pass (RGP)
    rgps.forEach(r => {
      const ref = r.rgpNo || `RGP-${r.id}`;
      const cancelInfo = cancellationMap.get(`rgp_${ref.toLowerCase()}`);
      const isCancelled = r.status === 'Cancelled' || Boolean(cancelInfo);

      let items = [];
      try {
        if (Array.isArray(r.entries)) items = r.entries;
        else if (typeof r.entries === 'string') items = JSON.parse(r.entries);
      } catch (_) { }

      const totalQty = items.reduce((acc, it) => acc + (Number(it.qty) || Number(it.quantity) || 0), 0);

      list.push({
        id: `RGP_${r.id}_${ref}`,
        rawId: r.id,
        refNo: ref,
        typeKey: 'rgp',
        typeLabel: 'Returnable Gate Pass (RGP)',
        badgeBg: '#f3e8ff',
        badgeColor: '#7e22ce',
        lotNo: items[0]?.lotNo || '',
        partyName: r.vendor || '—',
        style: r.purpose || r.department || '',
        fabric: r.rgpType || 'General Returnable',
        date: r.date || (r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : '—'),
        timestamp: r.createdAt ? new Date(r.createdAt).getTime() : 0,
        totalQty: totalQty || items.length,
        unit: items[0]?.unit || 'Items',
        totalAmount: 0,
        operator: r.preparedBy || 'Store Incharge',
        items,
        status: isCancelled ? 'Cancelled' : (r.status || 'Dispatched'),
        isCancelled,
        cancellationReason: cancelInfo?.reason || r.cancellation_reason || '',
        cancelledBy: cancelInfo?.cancelledBy || r.cancelled_by || '',
        cancelledAt: cancelInfo?.cancelledAt || r.cancelled_at || null,
        cancellationRemarks: cancelInfo?.remarks || '',
        raw: r
      });
    });

    // 2. Standard Purchase Orders (PO)
    pos.forEach(p => {
      const ref = p.poNumber || `PO-${p.id}`;
      const cancelInfo = cancellationMap.get(`po_${ref.toLowerCase()}`);
      const isCancelled = p.status === 'Cancelled' || Boolean(cancelInfo);

      let items = [];
      try {
        if (Array.isArray(p.items)) items = p.items;
        else if (typeof p.items === 'string') items = JSON.parse(p.items);
      } catch (_) { }

      const totalQty = items.reduce((acc, it) => acc + (Number(it.qty) || Number(it.quantity) || 0), 0);

      list.push({
        id: `PO_${p.id}_${ref}`,
        rawId: p.id,
        refNo: ref,
        typeKey: 'po',
        typeLabel: 'Standard Purchase Order (PO)',
        badgeBg: '#e0f2fe',
        badgeColor: '#0369a1',
        lotNo: p.designName || (items[0]?.lotNumber || ''),
        partyName: p.vendorName || '—',
        style: p.designName || '',
        fabric: p.designCategory || 'General Accessories',
        date: p.date || '—',
        timestamp: p.date ? new Date(p.date).getTime() : 0,
        totalQty: totalQty || items.length,
        unit: items[0]?.unit || 'Pcs',
        totalAmount: p.total || 0,
        operator: 'Store Manager',
        items,
        status: isCancelled ? 'Cancelled' : (p.status || 'Active'),
        isCancelled,
        cancellationReason: cancelInfo?.reason || p.cancellation_reason || '',
        cancelledBy: cancelInfo?.cancelledBy || p.cancelled_by || '',
        cancelledAt: cancelInfo?.cancelledAt || p.cancelled_at || null,
        cancellationRemarks: cancelInfo?.remarks || '',
        raw: p
      });
    });

    // 3. Dori PO Orders
    dooriOrders.forEach(d => {
      const ref = d.po_number || `DORI-LOT-${d.Lot_Number}`;
      const cancelInfo = cancellationMap.get(`dori_${ref.toLowerCase()}`) || cancellationMap.get(`dori_${String(d.Lot_Number).toLowerCase()}`);
      const isCancelled = d.status === 'Cancelled' || Boolean(cancelInfo);

      let items = [];
      try {
        if (d.Dori_Selections) {
          const sel = typeof d.Dori_Selections === 'string' ? JSON.parse(d.Dori_Selections) : d.Dori_Selections;
          Object.keys(sel).forEach(k => {
            items.push({ name: 'Dori Accessory', placement: k, type: sel[k]?.type || '', color: sel[k]?.color || '', qty: sel[k]?.qty || 0 });
          });
        }
      } catch (_) { }

      list.push({
        id: `DORI_${d.id}_${d.Lot_Number}`,
        rawId: d.id,
        refNo: ref,
        typeKey: 'dori',
        typeLabel: 'Dori PO Order',
        badgeBg: '#ccfbf1',
        badgeColor: '#0f766e',
        lotNo: d.Lot_Number,
        partyName: d.Supplier_Name || 'Dori Supplier',
        style: d.Style || d.Garment_Type || 'Dori Order',
        fabric: d.Fabric || '',
        date: d.Issue_Date || d.Material_Entry_Date || (d.Saved_At ? new Date(d.Saved_At).toLocaleDateString('en-GB') : '—'),
        timestamp: d.Saved_At ? new Date(d.Saved_At).getTime() : 0,
        totalQty: d.Total_Pieces || 0,
        unit: 'Mtrs / Pcs',
        totalAmount: d.Total_Cost || 0,
        operator: d.Supervisor || 'Dori Supervisor',
        items,
        status: isCancelled ? 'Cancelled' : (d.status || 'Active'),
        isCancelled,
        cancellationReason: cancelInfo?.reason || d.cancellation_reason || '',
        cancelledBy: cancelInfo?.cancelledBy || d.cancelled_by || '',
        cancelledAt: cancelInfo?.cancelledAt || d.cancelled_at || null,
        cancellationRemarks: cancelInfo?.remarks || '',
        raw: d
      });
    });

    // 4. Zip PO Orders (from cutting_header / zip)
    zipOrders.forEach(z => {
      const ref = z.po_number || `ZIP-LOT-${z.Lot_Number}`;
      const cancelInfo = cancellationMap.get(`zip_${ref.toLowerCase()}`) || cancellationMap.get(`zip_${String(z.Lot_Number).toLowerCase()}`);
      const isCancelled = z.status === 'Cancelled' || z.WIP_Status === 'Cancelled' || Boolean(cancelInfo);

      let items = [];
      try {
        if (z.zip_payload) {
          const payload = typeof z.zip_payload === 'string' ? JSON.parse(z.zip_payload) : z.zip_payload;
          if (payload.zipSelections) {
            Object.keys(payload.zipSelections).forEach(k => {
              items.push({ name: 'Zipper Component', placement: k, type: payload.zipSelections[k]?.type || '', color: payload.zipSelections[k]?.color || '', qty: payload.zipSelections[k]?.qty || 0 });
            });
          }
        }
      } catch (_) { }

      list.push({
        id: `ZIP_${z.id}_${z.Lot_Number}`,
        rawId: z.id,
        refNo: ref,
        typeKey: 'zip',
        typeLabel: 'Zip PO Order',
        badgeBg: '#ffedd5',
        badgeColor: '#c2410c',
        lotNo: z.Lot_Number,
        partyName: z.Supplier_Name || z.Party_Name || 'Zip Supplier',
        style: z.Style || z.Garment_Type || 'Zipper Order',
        fabric: z.Fabric || '',
        date: z.Date_of_Issue || z.Zip_Order_Date || (z.Saved_At ? new Date(z.Saved_At).toLocaleDateString('en-GB') : '—'),
        timestamp: z.Saved_At ? new Date(z.Saved_At).getTime() : 0,
        totalQty: z.Total_Pieces || z.Cutting_Qty || 0,
        unit: 'Pcs',
        totalAmount: z.Total_Cost || 0,
        operator: z.Supervisor || 'Cutting Supervisor',
        items,
        status: isCancelled ? 'Cancelled' : (z.status || 'Active'),
        isCancelled,
        cancellationReason: cancelInfo?.reason || z.cancellation_reason || '',
        cancelledBy: cancelInfo?.cancelledBy || z.cancelled_by || '',
        cancelledAt: cancelInfo?.cancelledAt || z.cancelled_at || null,
        cancellationRemarks: cancelInfo?.remarks || '',
        raw: z
      });
    });

    // 5. Scans (Checkpoints)
    scans.forEach(s => {
      const ref = `SCAN-#${s.id}`;
      const cancelInfo = cancellationMap.get(`scan_${s.id}`);
      const isCancelled = s.status === 'Cancelled' || Boolean(cancelInfo);

      list.push({
        id: `SCAN_${s.id}`,
        rawId: s.id,
        refNo: ref,
        typeKey: 'scan',
        typeLabel: `Scanner: ${s.scan_type || 'Checkpoint'}`,
        badgeBg: '#fef3c7',
        badgeColor: '#b45309',
        lotNo: s.lot_number || '',
        partyName: s.supplier_name || '—',
        style: s.scan_type || '',
        fabric: s.material_name || '',
        date: s.scanned_at ? new Date(s.scanned_at).toLocaleString('en-GB') : '—',
        timestamp: s.scanned_at ? new Date(s.scanned_at).getTime() : 0,
        totalQty: s.quantity || 0,
        unit: 'Pcs',
        totalAmount: 0,
        operator: s.person_name || 'Security Officer',
        items: [{ name: s.material_name, qty: s.quantity, placement: s.scan_type }],
        status: isCancelled ? 'Cancelled' : 'Verified Checkpoint',
        isCancelled,
        cancellationReason: cancelInfo?.reason || s.cancellation_reason || '',
        cancelledBy: cancelInfo?.cancelledBy || s.cancelled_by || '',
        cancelledAt: cancelInfo?.cancelledAt || s.cancelled_at || null,
        cancellationRemarks: cancelInfo?.remarks || '',
        raw: s
      });
    });

    // Sort by most recent
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [rgps, pos, dooriOrders, zipOrders, scans, cancellationMap]);

  // Map scans to lots / references for instant correlation
  const scansByRefMap = useMemo(() => {
    const map = new Map();
    scans.forEach(sc => {
      const candidates = [
        sc.lot_number ? String(sc.lot_number).toLowerCase().trim() : '',
        sc.material_name ? String(sc.material_name).toLowerCase().trim() : ''
      ].filter(Boolean);

      candidates.forEach(cand => {
        if (!map.has(cand)) map.set(cand, []);
        map.get(cand).push(sc);
      });
    });
    return map;
  }, [scans]);

  // Filtered List
  const filteredTransactions = useMemo(() => {
    return normalizedTransactions.filter(tx => {
      // 1. Search Query
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q ||
        tx.refNo.toLowerCase().includes(q) ||
        (tx.lotNo && tx.lotNo.toLowerCase().includes(q)) ||
        (tx.partyName && tx.partyName.toLowerCase().includes(q)) ||
        (tx.style && tx.style.toLowerCase().includes(q)) ||
        (tx.operator && tx.operator.toLowerCase().includes(q)) ||
        (tx.typeLabel && tx.typeLabel.toLowerCase().includes(q));

      // 2. Type Filter
      let matchesType = true;
      if (typeFilter === 'cancelled') {
        matchesType = tx.isCancelled;
      } else if (typeFilter !== 'all') {
        matchesType = tx.typeKey === typeFilter;
      }

      // 3. Status Filter
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = !tx.isCancelled;
      else if (statusFilter === 'cancelled') matchesStatus = tx.isCancelled;

      // 4. Date Range
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const txTime = tx.timestamp;
        if (dateFrom) {
          const from = new Date(dateFrom).getTime();
          if (txTime < from) matchesDate = false;
        }
        if (dateTo) {
          const to = new Date(dateTo).setHours(23, 59, 59, 999);
          if (txTime > to) matchesDate = false;
        }
      }

      return matchesSearch && matchesType && matchesStatus && matchesDate;
    });
  }, [normalizedTransactions, searchTerm, typeFilter, statusFilter, dateFrom, dateTo]);

  // Handle Cancellation Submission
  const handleConfirmCancel = async (cancelPayload) => {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/api/transactions/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cancelPayload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to cancel transaction.');
    }

    // Refresh data
    await fetchAllData(true);
    setCancellationNotice({
      refNo: cancelPayload.transactionRef,
      reason: cancelPayload.reason,
      cancelledBy: cancelPayload.cancelledBy,
      date: new Date().toLocaleString('en-GB')
    });
  };

  // Handle Restore
  const handleRestore = async (tx) => {
    if (!window.confirm(`Are you sure you want to restore / un-cancel ${tx.refNo}?`)) return;

    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/transactions/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionType: tx.typeKey,
          transactionRef: tx.refNo
        })
      });

      if (!res.ok) {
        throw new Error('Failed to restore transaction.');
      }

      await fetchAllData(true);
      if (selectedTxForDetails) setSelectedTxForDetails(null);
    } catch (err) {
      alert(err.message);
    }
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    const headers = ['Ref / Doc No', 'Type', 'Lot Number', 'Party / Vendor', 'Garment / Style', 'Quantity', 'Amount', 'Date', 'Operator', 'Status', 'Cancellation Reason'];
    const rows = filteredTransactions.map(tx => [
      `"${tx.refNo}"`,
      `"${tx.typeLabel}"`,
      `"${tx.lotNo || ''}"`,
      `"${(tx.partyName || '').replace(/"/g, '""')}"`,
      `"${(tx.style || '').replace(/"/g, '""')}"`,
      `"${tx.totalQty || 0} ${tx.unit || ''}"`,
      `"${tx.totalAmount || 0}"`,
      `"${tx.date || ''}"`,
      `"${(tx.operator || '').replace(/"/g, '""')}"`,
      `"${tx.isCancelled ? 'CANCELLED' : tx.status}"`,
      `"${(tx.cancellationReason || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Combined_Transactions_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF Report
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Combined Transactions Master Audit Report', 40, 45);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')} | Scope: RGP, Standard PO, Dori PO, Zip PO, & Scanners | Total: ${filteredTransactions.length} Records`, 40, 62);

    const headers = [['#', 'Doc / Ref No', 'Type', 'Lot #', 'Party / Vendor', 'Style / Details', 'Quantity', 'Date', 'Status']];
    const data = filteredTransactions.map((tx, idx) => [
      idx + 1,
      tx.refNo,
      tx.typeLabel,
      tx.lotNo || '—',
      tx.partyName || '—',
      tx.style || '—',
      `${tx.totalQty} ${tx.unit || ''}`,
      tx.date || '—',
      tx.isCancelled ? `CANCELLED (${tx.cancellationReason || 'Void'})` : tx.status
    ]);

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 75,
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      didParseCell: function (data) {
        if (data.column.index === 8 && String(data.cell.raw).startsWith('CANCELLED')) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    doc.save(`Combined_Transactions_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Calculate linked scans for a transaction
  const getRelatedScans = (tx) => {
    if (!tx) return [];
    const keys = [
      tx.lotNo ? tx.lotNo.toLowerCase().trim() : '',
      tx.refNo ? tx.refNo.toLowerCase().trim() : ''
    ].filter(Boolean);

    const found = [];
    keys.forEach(k => {
      const match = scansByRefMap.get(k);
      if (match) found.push(...match);
    });

    // Unique by scan ID
    return Array.from(new Map(found.map(s => [s.id, s])).values());
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', color: '#0f172a' }}>
      {/* Page Title & Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
            }}>
              <Layers size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                Combined Transactions & Scans Hub
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>
                All RGP, Standard PO, Dori PO, Zip PO & Gate Scanner Checkpoints in one master place with universal cancellation
              </p>
            </div>
          </div>
        </div>

        {/* Global Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => fetchAllData(true)}
            disabled={refreshing}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#059669',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileSpreadsheet size={15} />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
            }}
          >
            <Printer size={15} />
            <span>Print Audit PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        {/* Total Feed */}
        <div style={{
          padding: '16px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>All Records</span>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', marginTop: '4px' }}>
            {normalizedTransactions.length}
          </div>
          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>Combined Master Feed</span>
        </div>

        {/* RGPs */}
        <div style={{
          padding: '16px',
          background: '#faf5ff',
          borderRadius: '12px',
          border: '1px solid #e9d5ff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontSize: '11.5px', color: '#7e22ce', fontWeight: '700', textTransform: 'uppercase' }}>RGP Gate Passes</span>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#6b21a8', marginTop: '4px' }}>
            {rgps.length}
          </div>
          <span style={{ fontSize: '11px', color: '#a855f7', fontWeight: '600' }}>Dispatches & Returns</span>
        </div>

        {/* Standard POs */}
        <div style={{
          padding: '16px',
          background: '#f0f9ff',
          borderRadius: '12px',
          border: '1px solid #bae6fd',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontSize: '11.5px', color: '#0369a1', fontWeight: '700', textTransform: 'uppercase' }}>Standard POs</span>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#0284c7', marginTop: '4px' }}>
            {pos.length}
          </div>
          <span style={{ fontSize: '11px', color: '#0ea5e9', fontWeight: '600' }}>Purchase Orders</span>
        </div>

        {/* Dori POs */}
        <div style={{
          padding: '16px',
          background: '#f0fdfa',
          borderRadius: '12px',
          border: '1px solid #99f6e4',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontSize: '11.5px', color: '#0f766e', fontWeight: '700', textTransform: 'uppercase' }}>Dori POs</span>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#0d9488', marginTop: '4px' }}>
            {dooriOrders.length}
          </div>
          <span style={{ fontSize: '11px', color: '#14b8a6', fontWeight: '600' }}>Dori / Cord Orders</span>
        </div>

        {/* Zip POs */}
        <div style={{
          padding: '16px',
          background: '#fff7ed',
          borderRadius: '12px',
          border: '1px solid #fed7aa',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontSize: '11.5px', color: '#c2410c', fontWeight: '700', textTransform: 'uppercase' }}>Zip POs</span>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#ea580c', marginTop: '4px' }}>
            {zipOrders.length}
          </div>
          <span style={{ fontSize: '11px', color: '#f97316', fontWeight: '600' }}>Zipper Lot Orders</span>
        </div>

        {/* Scanner Checkpoints */}
        <div style={{
          padding: '16px',
          background: '#fefce8',
          borderRadius: '12px',
          border: '1px solid #fef08a',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontSize: '11.5px', color: '#a16207', fontWeight: '700', textTransform: 'uppercase' }}>Scanner Events</span>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#ca8a04', marginTop: '4px' }}>
            {scans.length}
          </div>
          <span style={{ fontSize: '11px', color: '#eab308', fontWeight: '600' }}>Gate & Security Scans</span>
        </div>

        {/* Cancelled Total */}
        <div style={{
          padding: '16px',
          background: '#fef2f2',
          borderRadius: '12px',
          border: '1.5px solid #fecdd3',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontSize: '11.5px', color: '#b91c1c', fontWeight: '700', textTransform: 'uppercase' }}>Cancelled Void</span>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#dc2626', marginTop: '4px' }}>
            {normalizedTransactions.filter(t => t.isCancelled).length}
          </div>
          <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700' }}>Audit Cancelled</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: '#ffffff',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '8px 12px',
          minWidth: '320px',
          flex: 1
        }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Search by PO#, RGP#, Lot#, Vendor, Style, Operator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              width: '100%',
              fontSize: '13px',
              color: '#0f172a'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Type Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All Combined' },
            { key: 'rgp', label: 'RGP' },
            { key: 'po', label: 'Standard PO' },
            { key: 'dori', label: 'Dori PO' },
            { key: 'zip', label: 'Zip PO' },
            { key: 'scan', label: 'Scanners' },
            { key: 'cancelled', label: '⛔ Cancelled' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: typeFilter === tab.key ? '#0284c7' : '#e2e8f0',
                background: typeFilter === tab.key ? '#0284c7' : '#ffffff',
                color: typeFilter === tab.key ? '#ffffff' : '#475569',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b' }}>
            <Calendar size={14} />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none'
              }}
            />
            <span>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                color: '#475569'
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{
                background: '#f8fafc',
                borderBottom: '1.5px solid #e2e8f0',
                color: '#475569',
                fontSize: '11.5px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                <th style={{ padding: '12px 14px' }}>Ref / Doc No</th>
                <th style={{ padding: '12px 14px' }}>Type</th>
                <th style={{ padding: '12px 14px' }}>Lot #</th>
                <th style={{ padding: '12px 14px' }}>Party / Vendor</th>
                <th style={{ padding: '12px 14px' }}>Style / Garment</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Quantity</th>
                <th style={{ padding: '12px 14px' }}>Linked Scans</th>
                <th style={{ padding: '12px 14px' }}>Date</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Actions & Cancellation</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                    <p style={{ margin: 0, fontWeight: '600' }}>Loading combined transactions and scanner checkpoints...</p>
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    <AlertCircle size={28} style={{ margin: '0 auto 8px' }} />
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#475569' }}>No transactions found</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Try adjusting your search criteria or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const relatedScans = getRelatedScans(tx);
                  const isCancelled = tx.isCancelled;

                  return (
                    <tr
                      key={tx.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isCancelled ? '#fff5f5' : '#ffffff',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* Ref No */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: '800',
                            fontSize: '13px',
                            color: isCancelled ? '#991b1b' : '#0f172a'
                          }}>
                            {tx.refNo}
                          </span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '800',
                          background: tx.badgeBg,
                          color: tx.badgeColor
                        }}>
                          {tx.typeLabel}
                        </span>
                      </td>

                      {/* Lot No */}
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0284c7' }}>
                        {tx.lotNo ? `Lot #${tx.lotNo}` : '—'}
                      </td>

                      {/* Party / Vendor */}
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: '#334155' }}>
                        {tx.partyName || '—'}
                      </td>

                      {/* Style / Garment */}
                      <td style={{ padding: '12px 14px', color: '#64748b' }}>
                        {tx.style || '—'}
                      </td>

                      {/* Quantity */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {tx.totalQty ? `${tx.totalQty} ${tx.unit || ''}` : '—'}
                      </td>

                      {/* Linked Scans */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {relatedScans.length > 0 ? (
                          <button
                            onClick={() => setSelectedTxForDetails(tx)}
                            style={{
                              background: '#f3e8ff',
                              border: '1px solid #d8b4fe',
                              color: '#7e22ce',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Click to view linked scanner events"
                          >
                            <QrCode size={13} />
                            <span>{relatedScans.length} Scanned</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>No scans</span>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {tx.date || '—'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {isCancelled ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '800',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fecdd3'
                          }}
                          title={`Cancelled by ${tx.cancelledBy}: ${tx.cancellationReason}`}
                          >
                            <Ban size={12} />
                            <span>CANCELLED</span>
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: '#f0fdf4',
                            color: '#15803d',
                            border: '1px solid #bbf7d0'
                          }}>
                            <CheckCircle2 size={12} />
                            <span>{tx.status}</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          {/* View Details */}
                          <button
                            onClick={() => setSelectedTxForDetails(tx)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                            title="View Full Details & Linked Scans"
                          >
                            <Eye size={13} />
                            <span>Details</span>
                          </button>

                          {/* View Bill */}
                          <button
                            onClick={() => setSelectedTxForBill(tx)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '6px',
                              border: '1px solid #bae6fd',
                              background: '#f0f9ff',
                              color: '#0284c7',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: '700'
                            }}
                            title="View & Print Official Bill Voucher"
                          >
                            <FileText size={13} />
                            <span>Bill</span>
                          </button>

                          {/* Cancellation Button */}
                          {!isCancelled ? (
                            <button
                              onClick={() => setSelectedTxForCancel(tx)}
                              style={{
                                padding: '5px 9px',
                                borderRadius: '6px',
                                border: '1px solid #fca5a5',
                                background: '#fee2e2',
                                color: '#b91c1c',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                                fontWeight: '700'
                              }}
                              title="Cancel this transaction with reason"
                            >
                              <Ban size={13} />
                              <span>Cancel</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(tx)}
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid #bbf7d0',
                                background: '#f0fdf4',
                                color: '#15803d',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}
                              title="Restore cancelled transaction"
                            >
                              <Undo2 size={12} />
                              <span>Restore</span>
                            </button>
                          )}
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

      {/* Cancellation Confirmation Toast / Banner */}
      {cancellationNotice && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#1e293b',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          zIndex: 99998,
          border: '1px solid #ef4444',
          maxWidth: '420px',
          animation: 'modalSlideUp 0.25s ease-out'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Ban size={20} color="#ffffff" />
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '14px', display: 'block' }}>Transaction Cancelled!</strong>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#cbd5e1' }}>
              <strong>{cancellationNotice.refNo}</strong> marked void. Reason: {cancellationNotice.reason}
            </p>
          </div>
          <button
            onClick={() => setCancellationNotice(null)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Cancellation Modal Form */}
      <CancelTransactionModal
        isOpen={Boolean(selectedTxForCancel)}
        onClose={() => setSelectedTxForCancel(null)}
        transaction={selectedTxForCancel}
        currentUser={currentUser}
        onConfirmCancel={handleConfirmCancel}
      />

      {/* Details & Scanner Modal */}
      <TransactionDetailsModal
        isOpen={Boolean(selectedTxForDetails)}
        onClose={() => setSelectedTxForDetails(null)}
        transaction={selectedTxForDetails}
        relatedScans={getRelatedScans(selectedTxForDetails)}
        onCancelClick={(tx) => setSelectedTxForCancel(tx)}
        onRestoreClick={handleRestore}
        onOpenBill={(tx) => {
          setSelectedTxForBill(tx);
        }}
      />

      {/* Bill & Voucher Modal */}
      <BillVoucherModal
        isOpen={Boolean(selectedTxForBill)}
        onClose={() => setSelectedTxForBill(null)}
        transaction={selectedTxForBill}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
