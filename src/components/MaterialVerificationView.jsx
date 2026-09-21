import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClipboardList, AlertTriangle, CheckSquare, CheckCircle, ArrowRight, Layers, HelpCircle, X, Shield, Send, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MaterialVerificationView({
  designs = [],
  materials = [],
  vendors = [],
  currencySymbol = 'R',
  currentUser = null,
  onRedirectToTab,
  onRedirectToZipPO,
  onRedirectToPO,
  onRedirectToRGP
}) {
  const approvedDesigns = designs.filter(d => d.status === 'Approved');

  // State variables
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [pieces, setPieces] = useState(100);
  const [bomMappings, setBomMappings] = useState([]);
  const [formSuccess, setFormSuccess] = useState('');
  const [dbPiecesCut, setDbPiecesCut] = useState(null);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [rgpSingleItem, setRgpSingleItem] = useState(null);

  // RGP Modal States
  const [showRgpModal, setShowRgpModal] = useState(false);
  const [rgpVendorId, setRgpVendorId] = useState('');
  const [rgpNotes, setRgpNotes] = useState('Sent for job work/finishing.');
  const [rgpDate, setRgpDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const selectedDesign = designs.find(d => d.id === selectedDesignId);

  // Filter designs based on search query
  const filteredDesigns = approvedDesigns.filter(design => {
    const q = searchQuery.toLowerCase();
    const lotIdMatch = String(design.id).toLowerCase().includes(q);
    const brandMatch = String(design.brand || '').toLowerCase().includes(q);
    const categoryMatch = String(design.category || '').toLowerCase().includes(q);
    return lotIdMatch || brandMatch || categoryMatch;
  });

  // Fetch total pieces cut from database when a design is selected
  useEffect(() => {
    if (!selectedDesignId) {
      setDbPiecesCut(null);
      return;
    }

    // Set fallback design quantity first
    if (selectedDesign && selectedDesign.quantity && selectedDesign.quantity > 0) {
      setPieces(selectedDesign.quantity);
      setDbPiecesCut(selectedDesign.quantity);
    }

    const fetchTotalPieces = async () => {
      try {
        const response = await fetch(`${getBackendUrl()}/api/cutting/${selectedDesignId}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.rows && data.rows.length > 0) {
            const totalPcs = data.rows.reduce((sum, row) => sum + (row.totalPcs || 0), 0);
            if (totalPcs > 0) {
              setPieces(totalPcs);
              setDbPiecesCut(totalPcs);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch total pieces from MySQL database:', err.message);
      }
    };

    fetchTotalPieces();
  }, [selectedDesignId, selectedDesign]);

  // Auto-generate mappings when design is selected or pieces input changes
  useEffect(() => {
    if (!selectedDesign || !selectedDesign.bom) {
      setBomMappings([]);
      return;
    }

    const requiredBom = selectedDesign.bom.filter(item => String(item.status).toLowerCase() === 'yes');

    const initialMappings = requiredBom.map(bomItem => {
      const detailLower = String(bomItem.detail || '').toLowerCase();
      const nameLower = String(bomItem.name || '').toLowerCase();
      const descLower = String(bomItem.description || '').trim().toLowerCase() ||
        (!/^\d+(\.\d+)?$/.test(detailLower.trim()) ? detailLower.trim() : '');

      let matchedMaterialId = bomItem.materialId || "";

      if (!matchedMaterialId && descLower) {
        let bestMaterial = null;
        let highestScore = 0;

        materials.forEach(m => {
          const mName = m.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
          const bName = nameLower.replace(/[^a-z0-9\s]/g, '');
          const bDesc = descLower.replace(/[^a-z0-9\s]/g, '');

          let score = 0;
          const cleanStr = str => str.replace(/\s+/g, '');
          const mClean = cleanStr(mName);
          const bDescClean = cleanStr(bDesc);

          if (mClean && bDescClean) {
            if (mClean === bDescClean) {
              score += 100;
            } else if (mClean.includes(bDescClean) || bDescClean.includes(mClean)) {
              score += 80;
            }
          }
          if (bName && mName.includes(bName)) {
            score += 10;
          }
          if (score > highestScore) {
            highestScore = score;
            bestMaterial = m;
          }
        });

        if (highestScore >= 15 && bestMaterial) {
          matchedMaterialId = bestMaterial.id;
        }
      }

      let defaultRate = 1.0;
      const parsedRate = parseInt(bomItem.detail, 10);
      if (!isNaN(parsedRate) && parsedRate >= 0) {
        defaultRate = parsedRate;
      } else {
        if (nameLower.includes('button') || detailLower.includes('button')) {
          defaultRate = 6.0;
        } else if (nameLower.includes('fabric') || detailLower.includes('fabric') || nameLower.includes('denim') || detailLower.includes('denim')) {
          defaultRate = 1.5;
        } else if (nameLower.includes('lace') || nameLower.includes('elastic')) {
          defaultRate = 0.5;
        }
      }

      return {
        bomItemName: bomItem.name,
        bomItemDetail: bomItem.description || 'Required',
        materialId: matchedMaterialId,
        ratePerPiece: defaultRate,
        issued: true
      };
    });

    setBomMappings(initialMappings);
  }, [selectedDesignId, selectedDesign, materials]);

  // Perform stock validation check
  const getValidationDetails = () => {
    let hasShortage = false;
    const computedItems = bomMappings.map(mapping => {
      const material = materials.find(m => m.id === mapping.materialId);
      const totalRequired = Math.round(pieces * mapping.ratePerPiece * 100) / 100;
      const currentStock = material ? material.stock : 0;
      const isShortage = totalRequired > currentStock;

      if (isShortage && mapping.issued) {
        hasShortage = true;
      }

      return {
        ...mapping,
        materialName: material ? (material.color && material.color !== 'Default' ? `${material.name} (${material.color})` : material.name) : 'Unknown Material',
        unit: material ? material.unit : 'pcs',
        currentStock,
        totalRequired,
        isShortage
      };
    });

    return { computedItems, hasShortage };
  };

  const { computedItems, hasShortage } = getValidationDetails();

  // Auto-select first component
  useEffect(() => {
    if (bomMappings && bomMappings.length > 0) {
      const { computedItems: latestComputed } = getValidationDetails();
      const firstShortage = latestComputed.find(item => item.isShortage);
      setSelectedItemName(firstShortage ? firstShortage.bomItemName : bomMappings[0].bomItemName);
    } else {
      setSelectedItemName('');
    }
  }, [bomMappings, pieces]);

  const selectedRowItem = computedItems.find(item => item.bomItemName === selectedItemName);

  const shortageItems = rgpSingleItem
    ? [{
      name: rgpSingleItem.bomItemName,
      qty: Math.round(Math.abs(rgpSingleItem.currentStock - rgpSingleItem.totalRequired) * 100) / 100,
      unit: rgpSingleItem.unit
    }]
    : computedItems.filter(item => item.issued && (item.currentStock - item.totalRequired < 0)).map(item => {
      const shortageQty = Math.abs(item.currentStock - item.totalRequired);
      return {
        name: item.bomItemName,
        qty: Math.round(shortageQty * 100) / 100,
        unit: item.unit
      };
    });

  // jsPDF RGP Generator
  const handlePrintRgp = () => {
    const doc = new jsPDF();
    const vendor = vendors.find(v => v.id === rgpVendorId) || { name: 'Walk-in Vendor', email: 'N/A', address: 'N/A' };
    const gpNumber = `GP-${Math.floor(100000 + Math.random() * 900000)}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55);
    doc.text('MH ACCESSORIES & BOM', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('Premium Garment Production Management System', 14, 25);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241);
    doc.text('RETURNABLE GATE PASS (RGP)', 14, 40);

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(14, 45, 196, 45);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);

    doc.text(`Gate Pass No: ${gpNumber}`, 14, 55);
    doc.text(`Date Issued: ${rgpDate}`, 14, 66);
    doc.text(`Lot Number: Lot ${selectedDesignId}`, 14, 77);

    doc.text('Sent To Vendor/Receiver:', 120, 55);
    doc.setFont('helvetica', 'bold');
    doc.text(vendor.name, 120, 66);
    doc.setFont('helvetica', 'normal');
    doc.text(`Email: ${vendor.email || 'N/A'}`, 120, 77);
    doc.text(`Address: ${vendor.address || 'N/A'}`, 120, 88);

    doc.text(`Purpose/Notes: ${rgpNotes}`, 14, 105);

    const tableColumns = ['S.No', 'Item Description', 'Quantity Requested', 'Unit'];
    const tableRows = shortageItems.map((item, idx) => [
      idx + 1,
      item.name,
      item.qty.toLocaleString(),
      item.unit
    ]);

    autoTable(doc, {
      startY: 115,
      head: [tableColumns],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241], halign: 'center' },
      columnStyles: {
        0: { width: 15, halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'center' }
      }
    });

    const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 160) + 40;
    doc.setFont('helvetica', 'normal');
    doc.line(14, finalY, 74, finalY);
    doc.text('Authorized Signatory (Issuer)', 14, finalY + 5);

    doc.line(136, finalY, 196, finalY);
    doc.text('Receiver Signature (Vendor)', 136, finalY + 5);

    doc.save(`RGP_${gpNumber}_${rgpDate}.pdf`);
    setFormSuccess('RGP PDF generated and downloaded successfully!');
    setShowRgpModal(false);
    setTimeout(() => setFormSuccess(''), 5000);
  };

  return (
    <div className="animate-fade" style={{ paddingBottom: '60px' }}>
      <style>{`
        .horizontal-verify-form {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: flex-end;
        }
        .horizontal-form-item {
          flex: 1 1 200px;
          margin-bottom: 0 !important;
        }
        .horizontal-form-item-large {
          flex: 2 1 300px;
          margin-bottom: 0 !important;
        }
        @media (max-width: 768px) {
          .horizontal-verify-form {
            flex-direction: column;
            align-items: stretch;
          }
          .horizontal-form-item, .horizontal-form-item-large {
            flex: 1 1 auto;
          }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '22px', fontWeight: '700' }}>Stock Accessories Panel</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          </p>
        </div>
      </div>

      {formSuccess && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '16px',
          backgroundColor: 'var(--success-light)',
          color: 'var(--success)',
          borderRadius: 'var(--border-radius-md)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          marginBottom: '24px',
          fontWeight: '600'
        }}>
          <CheckCircle size={20} />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* Select Lot Panel */}
      <div className="panel animate-scale" style={{ marginBottom: '24px', position: 'relative', zIndex: 10 }}>
        <div className="panel-header">
          <h3 className="panel-title">
            <CheckSquare size={18} className="text-accent" />
            Stock Accessories Settings
          </h3>
        </div>

        <div style={{ padding: '16px 20px 20px 20px' }}>
          <div className="horizontal-verify-form">
            {/* Lot Search input selector */}
            <div className="horizontal-form-item-large" style={{ position: 'relative' }}>
              <label className="form-label" style={{ marginBottom: '6px' }}>Search & Select Lot Number</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="🔍 Type Lot ID, Brand or Style..."
                  value={
                    isFocused
                      ? searchQuery
                      : (selectedDesign
                        ? `Lot ${selectedDesign.id} — ${selectedDesign.brand || 'No Brand'} (${selectedDesign.category})`
                        : ''
                      )
                  }
                  onFocus={() => {
                    setIsFocused(true);
                    setIsOpen(true);
                    setSearchQuery('');
                  }}
                  onClick={() => setIsOpen(true)}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingRight: '32px', height: '42px' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '10px',
                    pointerEvents: 'none'
                  }}
                >
                  ▼
                </div>

                {isOpen && (
                  <>
                    {/* Overlay */}
                    <div
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 40,
                        background: 'transparent'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        setIsFocused(false);
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--border-radius-md)',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 100,
                        maxHeight: '260px',
                        overflowY: 'auto',
                        marginTop: '4px',
                        padding: '6px 0'
                      }}
                    >
                      {filteredDesigns.length === 0 ? (
                        <div style={{ padding: '12px 16px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '13px' }}>
                          No matching lots found
                        </div>
                      ) : (
                        filteredDesigns.map((design) => {
                          const isSelected = design.id === selectedDesignId;
                          return (
                            <div
                              key={design.id}
                              onClick={() => {
                                setSelectedDesignId(design.id);
                                setIsOpen(false);
                                setIsFocused(false);
                              }}
                              style={{
                                padding: '10px 16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
                                color: 'var(--text-main)',
                                fontSize: '13px',
                                transition: 'background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                            >
                              <div>
                                <strong>Lot {design.id}</strong>
                                <span style={{ marginLeft: '8px', fontSize: '11px', opacity: 0.8 }}>
                                  ({design.category}) &mdash; {design.brand || 'No Brand'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Pieces to manufacture */}
            <div className="horizontal-form-item">
              <label className="form-label" style={{ marginBottom: '6px' }}>Pieces to Verify</label>
              <input
                type="number"
                className="form-input"
                min="1"
                placeholder="e.g. 500"
                value={pieces}
                onChange={(e) => setPieces(Math.max(1, Number(e.target.value)))}
                required
                style={{ height: '42px' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Checklist / Requirements Display */}
      <div className="panel animate-scale" style={{ minHeight: '320px', width: '100%', position: 'relative', zIndex: 1 }}>
        <div className="panel-header">
          <h3 className="panel-title">
            <Layers size={18} className="text-accent" />
            Verified Accessory Requirements
          </h3>
        </div>

        {!selectedDesign ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', color: 'var(--text-muted)', textAlign: 'center' }}>
            <HelpCircle size={48} strokeWidth={1} style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', fontWeight: '500' }}>Select an approved design lot above to analyze stock accessories data.</p>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <strong>Garment Item:</strong> {selectedDesign.category}<br />
                <strong>Primary Fabric:</strong> {selectedDesign.fabricType}
              </div>
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <strong>Design Pieces:</strong> {selectedDesign.quantity || 'N/A'}<br />
                <strong>MySQL Cut Pieces:</strong> {dbPiecesCut !== null ? <strong>{dbPiecesCut}</strong> : <span style={{ color: 'var(--text-muted)' }}>No matrix data</span>}
              </div>
            </div>


            {/* Checklist table */}
            <div className="custom-table-container">
              <table className="custom-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>Select</th>
                    <th>BOM Component</th>
                    <th>Target Material</th>
                    <th>Target Usage</th>
                    <th>Total Needed</th>
                    <th>Current Stock</th>
                    <th style={{ textAlign: 'center' }}>Balance</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {computedItems.map((item, idx) => {
                    const balance = item.currentStock - item.totalRequired;
                    const cleanBalance = Math.round(balance * 100) / 100;
                    const isSelected = item.bomItemName === selectedItemName;
                    return (
                      <tr
                        key={idx}
                        style={{
                          opacity: item.issued ? 1 : 0.6,
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent'
                        }}
                        onClick={() => setSelectedItemName(item.bomItemName)}
                      >
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="radio"
                            name="selectedBOMRow"
                            checked={isSelected}
                            onChange={() => setSelectedItemName(item.bomItemName)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td><strong>{item.bomItemName}</strong></td>
                        <td>{item.materialName}</td>
                        <td>{item.ratePerPiece} {item.unit} / pc</td>
                        <td><strong>{item.totalRequired.toLocaleString()} {item.unit}</strong></td>
                        <td>{item.currentStock.toLocaleString()} {item.unit}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: cleanBalance < 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {cleanBalance > 0 ? `+${cleanBalance.toLocaleString()}` : cleanBalance.toLocaleString()} {item.unit}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {item.isShortage ? (
                            <span className="status-badge rejected" style={{ fontWeight: 'bold' }}>Shortage</span>
                          ) : (
                            <span className="status-badge verified" style={{ fontWeight: 'bold' }}>Available</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Row Action Bar */}
            {selectedRowItem && (
              <div className="panel animate-scale" style={{
                marginTop: '20px',
                padding: '16px 20px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--accent-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                boxShadow: 'var(--shadow-md)',
                position: 'relative',
                zIndex: 5
              }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Selected Component Actions</span>
                  <strong style={{ fontSize: '16px', color: 'var(--text-main)' }}>{selectedRowItem.bomItemName}</strong>
                  <span style={{ fontSize: '13px', marginLeft: '12px', color: selectedRowItem.isShortage ? 'var(--danger)' : 'var(--success)', fontWeight: '600' }}>
                    {selectedRowItem.isShortage
                      ? `Shortage of ${Math.abs(selectedRowItem.currentStock - selectedRowItem.totalRequired).toLocaleString()} ${selectedRowItem.unit}`
                      : `In Stock (+${(selectedRowItem.currentStock - selectedRowItem.totalRequired).toLocaleString()} ${selectedRowItem.unit})`
                    }
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const itemName = String(selectedRowItem.bomItemName || '').toLowerCase();
                      const shortageQty = Math.round(Math.abs(selectedRowItem.currentStock - selectedRowItem.totalRequired) * 100) / 100;

                      if (itemName === 'zip') {
                        onRedirectToZipPO && onRedirectToZipPO(selectedDesign.id, 'zip');
                      } else if (itemName === 'doori' || itemName === 'dori') {
                        onRedirectToZipPO && onRedirectToZipPO(selectedDesign.id, 'dori');
                      } else {
                        if (onRedirectToPO) {
                          onRedirectToPO({
                            lotId: selectedDesign.id,
                            itemName: selectedRowItem.bomItemName,
                            qty: shortageQty > 0 ? shortageQty : selectedRowItem.totalRequired,
                            unit: selectedRowItem.unit,
                            description: selectedRowItem.bomItemDetail || ''
                          });
                        } else {
                          onRedirectToTab && onRedirectToTab('generate_po');
                        }
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: 'var(--accent-color)',
                      color: '#fff',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px'
                    }}
                  >
                    Generate PO
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const shortageItems = selectedRowItem ? [{
                        lotNo: selectedDesignId,
                        itemDesc: selectedRowItem.bomItemName,
                        qty1: selectedRowItem.shortageQty,
                        qty2: "",
                        uom: selectedRowItem.unit || "pcs",
                        department: selectedRowItem.department || "Production",
                        purpose: "Shortage Restock"
                      }] : [];
                      
                      const rgpData = {
                        date: new Date().toISOString().split('T')[0],
                        vendor: "",
                        rgpType: "Accessories",
                        department: selectedRowItem.department || "Production",
                        purpose: "Shortage Restock",
                        itemDesc: selectedRowItem.bomItemName,
                        qty: selectedRowItem.shortageQty,
                        uom: selectedRowItem.unit || "pcs",
                        entries: shortageItems
                      };
                      if (onRedirectToRGP) {
                        onRedirectToRGP(rgpData);
                      } else if (onRedirectToTab) {
                        onRedirectToTab('rgp');
                      }
                    }}
                    disabled={!selectedRowItem.isShortage}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: !selectedRowItem.isShortage ? 'var(--text-muted)' : 'var(--text-main)',
                      fontWeight: 'bold',
                      cursor: !selectedRowItem.isShortage ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      opacity: !selectedRowItem.isShortage ? 0.6 : 1
                    }}
                  >
                    Create RGP
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RGP Modal */}
      {showRgpModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-main)',
            padding: '28px',
            borderRadius: 'var(--border-radius-lg)',
            width: '90%',
            maxWidth: '500px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowRgpModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: 'var(--accent-color)' }}>
              Generate Returnable Gate Pass (RGP)
              {rgpSingleItem && ` for ${rgpSingleItem.bomItemName}`}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Create an RGP documentation for shortage items sent out for job work/vendors.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handlePrintRgp(); }}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Select Vendor / Receiver</label>
                <select
                  className="form-input"
                  value={rgpVendorId}
                  onChange={(e) => setRgpVendorId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.materialsJoined})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Gate Pass Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={rgpDate}
                  onChange={(e) => setRgpDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Purpose / Notes</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', padding: '10px', resize: 'vertical' }}
                  value={rgpNotes}
                  onChange={(e) => setRgpNotes(e.target.value)}
                  placeholder="e.g. Sent for printing or job work restock"
                />
              </div>

              <div style={{ maxHeight: '160px', overflowY: 'auto', padding: '10px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                <strong style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>RGP Shortage Items:</strong>
                {shortageItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
                    <span>{item.name}</span>
                    <strong>{item.qty} {item.unit}</strong>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRgpModal(false)}
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-accent"
                  style={{ padding: '8px 16px', fontSize: '13px', backgroundColor: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Print RGP PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
