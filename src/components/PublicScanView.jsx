import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect } from 'react';
import { QrCode, User, Check, AlertCircle, ArrowLeft, Loader2, Package, Truck, Layers } from 'lucide-react';

export default function PublicScanView({ initialAction = '', initialLot = '', initialPoType = '', onBackToLogin }) {
  const [lotNumber, setLotNumber] = useState(initialLot);
  const [scanType, setScanType] = useState('gate_entry');
  const [personName, setPersonName] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [customMaterial, setCustomMaterial] = useState('');
  const [quantity, setQuantity] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [customSupplier, setCustomSupplier] = useState('');

  // Simplified UX Mode
  const [isSimplifiedMode, setIsSimplifiedMode] = useState(!!initialLot);

  // Loaded Options
  const [lotLoading, setLotLoading] = useState(false);
  const [designInfo, setDesignInfo] = useState(null);
  const [bomMaterials, setBomMaterials] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [allPOs, setAllPOs] = useState([]);

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Get dynamic backend URL depending on browser host
  

  // Map URL actions to dropdown scan types
  useEffect(() => {
    if (initialAction === 'gateForm' || initialAction === 'gate') setScanType('gate_entry');
    else if (initialAction === 'materialForm' || initialAction === 'receive') setScanType('material_in');
    else if (initialAction === 'supplierForm') setScanType('supplier_entry');
    else if (initialAction === 'rgpEntryForm' || initialAction === 'rgp_entry') setScanType('rgp_entry');
    else if (initialAction === 'rgpReturnForm' || initialAction === 'rgp_return') setScanType('rgp_return');
  }, [initialAction]);

  // Load Lot Design Details & Lists
  useEffect(() => {
    const backendUrl = getBackendUrl();

    // Fetch Vendors
    fetch(`${backendUrl}/api/vendors`)
      .then(res => res.json())
      .then(data => setVendors(data))
      .catch(err => console.error('Failed to load vendors:', err));

    // Fetch All Materials (for fallback)
    fetch(`${backendUrl}/api/materials`)
      .then(res => res.json())
      .then(data => setAllMaterials(data))
      .catch(err => console.error('Failed to load materials:', err));

    // Fetch Purchase Orders
    fetch(`${backendUrl}/api/pos`)
      .then(res => res.json())
      .then(data => setAllPOs(data))
      .catch(err => console.error('Failed to load POs:', err));
  }, []);

  // Fetch specific Lot data when Lot number changes
  useEffect(() => {
    if (!lotNumber) {
      setDesignInfo(null);
      setBomMaterials([]);
      return;
    }

    setLotLoading(true);
    const backendUrl = getBackendUrl();

    fetch(`${backendUrl}/api/public/lot/${encodeURIComponent(lotNumber.trim())}`)
      .then(res => {
        if (!res.ok) throw new Error('Lot not found');
        return res.json();
      })
      .then(data => {
        setDesignInfo(data);
        const materials = [];
        if (data.bom && Array.isArray(data.bom)) {
          data.bom.forEach(item => {
            if (item.status === 'Yes' || item.detail) {
              const name = item.description || item.name;
              if (name && !materials.includes(name)) {
                materials.push(name);
              }
            }
          });
        }
        setBomMaterials(materials);
      })
      .catch(() => {
        setDesignInfo(null);
        setBomMaterials([]);
        setMaterialName('');
      })
      .finally(() => {
        setLotLoading(false);
      });
  }, [lotNumber]);

  // Set default material selection based on poType when materials load
  useEffect(() => {
    if (bomMaterials.length > 0) {
      if (initialPoType === 'zip') {
        const zipMat = bomMaterials.find(m => m.toLowerCase().includes('zip'));
        if (zipMat) {
          setMaterialName(zipMat);
          return;
        }
      } else if (initialPoType === 'dori') {
        const doriMat = bomMaterials.find(m => {
          const lower = m.toLowerCase();
          return lower.includes('dori') || lower.includes('thread') || lower.includes('drawstring') || lower.includes('nara') || lower.includes('lace') || lower.includes('tape');
        });
        if (doriMat) {
          setMaterialName(doriMat);
          return;
        }
      }
      setMaterialName(bomMaterials[0]);
    } else if (allMaterials.length > 0) {
      setMaterialName(allMaterials[0].name);
    } else {
      setMaterialName('other');
    }
  }, [bomMaterials, allMaterials, initialPoType]);

  // Set default supplier selection based on matching PO, RGP, Dori, Zip, or vendors
  useEffect(() => {
    if (designInfo && designInfo.brand && designInfo.brand !== 'N/A' && designInfo.brand !== '—' && designInfo.brand !== 'Mohit Hosiery') {
      setSupplierName(designInfo.brand);
      return;
    }

    if (lotNumber && allPOs.length > 0) {
      const trimmedLot = lotNumber.trim().toUpperCase();
      const matchingPO = allPOs.find(po => {
        const designName = String(po.designName || '').toUpperCase();
        const poNum = String(po.poNumber || '').toUpperCase();
        return designName.includes(trimmedLot) || poNum === trimmedLot;
      });
      if (matchingPO && matchingPO.vendorName) {
        setSupplierName(matchingPO.vendorName);
        return;
      }
    }

    if (vendors.length > 0) {
      setSupplierName(vendors[0].name);
    } else {
      setSupplierName('other');
    }
  }, [lotNumber, allPOs, vendors, designInfo]);

  // Set default quantity from lot/po/rgp if available
  useEffect(() => {
    if (designInfo && designInfo.quantity && !quantity) {
      setQuantity(String(designInfo.quantity));
    }
  }, [designInfo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    const finalMaterial = materialName === 'other' ? customMaterial.trim() : materialName;
    const finalSupplier = supplierName === 'other' ? customSupplier.trim() : supplierName;

    if (!personName.trim()) {
      setErrorMessage('Please enter the person name.');
      setIsSubmitting(false);
      return;
    }
    if (!finalMaterial) {
      setErrorMessage('Please select or enter a material name.');
      setIsSubmitting(false);
      return;
    }
    if (scanType !== 'gate_entry' && (!quantity || Number(quantity) <= 0)) {
      setErrorMessage('Please enter a valid positive quantity.');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      lot_number: lotNumber.trim(),
      scan_type: scanType,
      person_name: personName.trim(),
      material_name: finalMaterial,
      quantity: scanType === 'gate_entry' ? 0 : Number(quantity),
      supplier_name: finalSupplier || 'N/A'
    };

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server error saving log');
      }

      setSubmitSuccess(true);
    } catch (err) {
      setErrorMessage(err.message || 'Connection to server failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setPersonName('');
    setQuantity('');
    setCustomMaterial('');
    setCustomSupplier('');
    setSubmitSuccess(false);
    setErrorMessage('');
    if (bomMaterials.length > 0) {
      setMaterialName(bomMaterials[0]);
    } else {
      setMaterialName('other');
    }
    if (vendors.length > 0) {
      setSupplierName(vendors[0].name);
    } else {
      setSupplierName('other');
    }
  };

  const handleExit = () => {
    try {
      window.close();
    } catch (e) {
      console.warn("Failed to close window directly:", e);
    }
    if (onBackToLogin) {
      onBackToLogin();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a', // Premium sleek dark mode
      color: '#f8fafc',
      fontFamily: 'Inter, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 16px',
      boxSizing: 'border-box'
    }}>
      {/* Header Area */}
      <header style={{
        width: '100%',
        maxWidth: '480px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <QrCode size={28} style={{ color: '#6366f1' }} />
          <span style={{ fontWeight: '800', fontSize: '18px', letterSpacing: '0.05em' }}>MH SCANNER</span>
        </div>
        <button
          onClick={onBackToLogin}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#f8fafc',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.15)'}
          onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.08)'}
        >
          <ArrowLeft size={14} />
          <span>Login Portal</span>
        </button>
      </header>

      {/* Main Container Card */}
      <main style={{
        width: '100%',
        maxWidth: '480px',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '28px',
        boxSizing: 'border-box',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
      }}>

        {submitSuccess ? (
          /* SUCCESS ANIMATION AND VIEW */
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '2px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              color: '#10b981'
            }}>
              <Check size={36} strokeWidth={3} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: '#10b981' }}>Update Successfully!</h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5, marginBottom: '24px' }}>
              The scan entry details were successfully registered in the database.
            </p>
            <button
              onClick={handleExit}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                border: 'none',
                color: '#fff',
                padding: '12px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.2)'
              }}
            >
              Exit Scanner
            </button>
          </div>
        ) : (
          /* FORM SUBMISSION VIEW */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px 0', background: 'linear-gradient(to right, #a5b4fc, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Scan Material Logger
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                Please fill in the receipt details to store in G-PDMS.
              </p>
            </div>

            {errorMessage && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {isSimplifiedMode ? (
              /* SIMPLIFIED UX FORM FIELDS */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Prefilled Summary Card */}
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1.5px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {/* Badges Row */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      color: '#a5b4fc',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.02em'
                    }}>
                      {lotNumber?.startsWith('PO') ? 'PO' : 'Lot'}: #{lotNumber}
                    </div>
                    <div style={{
                      backgroundColor: 
                        scanType === 'gate_entry' ? 'rgba(16, 185, 129, 0.15)' :
                        scanType === 'material_in' ? 'rgba(59, 130, 246, 0.15)' :
                        scanType === 'printing_gate_out' ? 'rgba(249, 115, 22, 0.15)' :
                        scanType === 'rgp_entry' ? 'rgba(168, 85, 247, 0.15)' :
                        scanType === 'rgp_return' ? 'rgba(236, 72, 153, 0.15)' :
                        'rgba(245, 158, 11, 0.15)',
                      border: 
                        scanType === 'gate_entry' ? '1px solid rgba(16, 185, 129, 0.3)' :
                        scanType === 'material_in' ? '1px solid rgba(59, 130, 246, 0.3)' :
                        scanType === 'printing_gate_out' ? '1px solid rgba(249, 115, 22, 0.3)' :
                        scanType === 'rgp_entry' ? '1px solid rgba(168, 85, 247, 0.3)' :
                        scanType === 'rgp_return' ? '1px solid rgba(236, 72, 153, 0.3)' :
                        '1px solid rgba(245, 158, 11, 0.3)',
                      color: 
                        scanType === 'gate_entry' ? '#34d399' :
                        scanType === 'material_in' ? '#60a5fa' :
                        scanType === 'printing_gate_out' ? '#fb923c' :
                        scanType === 'rgp_entry' ? '#c084fc' :
                        scanType === 'rgp_return' ? '#f472b6' :
                        '#fbbf24',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em'
                    }}>
                      {scanType.replace('_', ' ')}
                    </div>
                  </div>

                  {/* Garment Details & Style if loaded */}
                  {designInfo && (
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#e2e8f0', 
                      fontWeight: '600',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      paddingBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Package size={14} style={{ color: '#94a3b8' }} />
                      <span>{designInfo.name} ({designInfo.style})</span>
                    </div>
                  )}

                  {/* Prefilled Fields info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Material:</span>
                      <span style={{ fontWeight: '600', color: '#f1f5f9' }}>{materialName === 'other' ? (customMaterial || 'Custom Material') : materialName}</span>
                    </div>
                    {designInfo?.date && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8' }}>Issue Date:</span>
                        <span style={{ fontWeight: '600', color: '#f1f5f9' }}>{designInfo.date}</span>
                      </div>
                    )}
                    {designInfo?.quantity && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8' }}>{lotNumber?.startsWith('PO') ? 'PO Qty/Pieces' : 'Lot Qty/Pieces'}:</span>
                        <span style={{ fontWeight: '600', color: '#f1f5f9' }}>{designInfo.quantity} pcs</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operator Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Enter Your Name
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <User size={16} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 12px 12px 38px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1.5px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Qty/Pieces */}
                {scanType !== 'gate_entry' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Qty / Pieces
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Package size={16} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
                      <input
                        type="number"
                        required
                        min="0.01"
                        step="any"
                        placeholder="Enter quantity"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 12px 12px 38px',
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1.5px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                )}

              </div>
            ) : (
              /* ORIGINAL DETAILED FORM FIELDS */
              <>
                {/* Lot & Scan Type Row */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {/* Lot Number */}
                  <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {lotNumber?.startsWith('PO') ? 'PO Number' : 'Lot Number'}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={lotNumber}
                        onChange={(e) => setLotNumber(e.target.value)}
                        placeholder="Enter Lot (e.g. 11202)"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1.5px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '13px',
                          fontWeight: '700',
                          boxSizing: 'border-box'
                        }}
                      />
                      {lotLoading && (
                        <Loader2 size={16} style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#6366f1',
                          animation: 'spin 1.5s linear infinite'
                        }} />
                      )}
                    </div>
                  </div>

                  {/* Scan Entry Type */}
                  <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Entry Type
                    </label>
                    <select
                      value={scanType}
                      onChange={(e) => setScanType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1.5px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        fontWeight: '600',
                        boxSizing: 'border-box',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="gate_entry" style={{ background: '#1e293b' }}>Gate Entry</option>
                      <option value="material_in" style={{ background: '#1e293b' }}>Material In</option>
                      <option value="supplier_entry" style={{ background: '#1e293b' }}>Supplier Entry</option>
                      <option value="printing_gate_out" style={{ background: '#1e293b' }}>Printing Gate Out</option>
                      <option value="rgp_entry" style={{ background: '#1e293b' }}>RGP Out / Issue</option>
                      <option value="rgp_return" style={{ background: '#1e293b' }}>RGP Return</option>
                    </select>
                  </div>
                </div>

                {/* Design Spec Summary Panel if loaded */}
                {designInfo && (
                  <div style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    border: '1.5px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a5b4fc', fontWeight: 'bold' }}>Style Ref:</span>
                      <span style={{ fontWeight: '700' }}>{designInfo.style}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a5b4fc', fontWeight: 'bold' }}>Garment/Category:</span>
                      <span style={{ fontWeight: '700' }}>{designInfo.name} ({designInfo.category})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a5b4fc', fontWeight: 'bold' }}>{lotNumber?.startsWith('PO') ? 'Total PO Pcs' : 'Total Lot Pcs'}:</span>
                      <span style={{ fontWeight: '700' }}>{designInfo.quantity} pcs</span>
                    </div>
                  </div>
                )}

                {/* Person Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Person Name
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <User size={16} style={{ position: 'absolute', left: '12px', color: '#64748b' }} />
                    <input
                      type="text"
                      required
                      placeholder="Enter name of operator/receiver"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 38px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1.5px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Material Selection / Custom */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Material Name
                  </label>
                  <select
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1.5px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      marginBottom: materialName === 'other' ? '8px' : '0'
                    }}
                  >
                    {/* BOM Mat List if lot is loaded */}
                    {bomMaterials.length > 0 && (
                      <optgroup label="Lot BOM Materials" style={{ background: '#1e293b' }}>
                        {bomMaterials.map((mat, i) => (
                          <option key={i} value={mat} style={{ background: '#1e293b' }}>{mat}</option>
                        ))}
                      </optgroup>
                    )}

                    {/* All Active Materials list as secondary */}
                    {allMaterials.length > 0 && (
                      <optgroup label="Global Inventory Materials" style={{ background: '#1e293b' }}>
                        {allMaterials.map(mat => (
                          <option key={mat.id} value={mat.name} style={{ background: '#1e293b' }}>{mat.name}</option>
                        ))}
                      </optgroup>
                    )}

                    <option value="other" style={{ background: '#1e293b', fontWeight: 'bold' }}>+ Other (Type Custom Name)</option>
                  </select>

                  {materialName === 'other' && (
                    <input
                      type="text"
                      required
                      placeholder="Type material description/name"
                      value={customMaterial}
                      onChange={(e) => setCustomMaterial(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1.5px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  )}
                </div>

                {/* Quantity */}
                {scanType !== 'gate_entry' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      placeholder="Enter quantity received/sent"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1.5px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}



                {/* Back to quick scan toggle */}
                {initialLot && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setIsSimplifiedMode(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#818cf8',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline'
                      }}
                    >
                      ← Back to Quick Scan Form
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                border: 'none',
                color: '#fff',
                padding: '12px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '10px',
                boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2)',
                transition: 'opacity 0.2s'
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1.5s linear' }} />
                  <span>Logging entry...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Submit Entry</span>
                </>
              )}
            </button>
          </form>
        )}
      </main>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
