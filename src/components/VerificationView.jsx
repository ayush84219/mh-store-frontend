import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, AlertTriangle, ShieldCheck, Check, X, FileText } from 'lucide-react';

export default function VerificationView({
  designs,
  onUpdateStatus,
  currencySymbol = 'R'
}) {
  const pendingDesigns = designs.filter(d => d.status === 'In Verification' || d.status === 'Rejected');
  const [selectedId, setSelectedId] = useState(pendingDesigns[0]?.id || null);
  const [revisionComments, setRevisionComments] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setValidationError('');
    setRevisionComments('');
  }, [selectedId]);

  // Keep selectedId synchronized with designs prop updates
  useEffect(() => {
    if (pendingDesigns.length > 0) {
      if (!selectedId || !pendingDesigns.some(d => d.id === selectedId)) {
        setSelectedId(pendingDesigns[0].id);
      }
    } else {
      setSelectedId(null);
    }
  }, [designs]);

  const canvasRef = useRef(null);

  const selectedDesign = designs.find(d => d.id === selectedId) || pendingDesigns[0];

  // Draw pattern visualizer on Canvas depending on selected item
  useEffect(() => {
    if (!canvasRef.current || !selectedDesign) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid background
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Set CAD blueprint styling
    ctx.strokeStyle = '#3b82f6';
    ctx.fillStyle = '#eff6ff';
    ctx.lineWidth = 2.5;

    ctx.beginPath();

    const category = (selectedDesign.category || '').toLowerCase();

    if (
      category.includes('t-shirt') ||
      category.includes('shirt') ||
      category.includes('sweatshirt') ||
      category.includes('sandow') ||
      category.includes('dropshoulder') ||
      category.includes('upper')
    ) {
      // Draw Shirt Pattern CAD layout
      ctx.moveTo(100, 40); // Collar left
      ctx.lineTo(150, 40); // Collar right
      ctx.lineTo(220, 70); // Right sleeve top
      ctx.lineTo(200, 110); // Right sleeve cuff
      ctx.lineTo(175, 100); // Right sleeve bottom
      ctx.lineTo(175, 260); // Right hem bottom
      ctx.lineTo(75, 260);  // Left hem bottom
      ctx.lineTo(75, 100);  // Left sleeve bottom
      ctx.lineTo(50, 110);  // Left sleeve cuff
      ctx.lineTo(30, 70);   // Left sleeve top
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Measurement lines (Collar)
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(100, 30);
      ctx.lineTo(150, 30);
      ctx.stroke();
      ctx.fillStyle = '#e11d48';
      ctx.font = '9px Inter';
      ctx.fillText('Collar: 38cm', 105, 25);

      // Measurement lines (Chest)
      ctx.beginPath();
      ctx.moveTo(75, 120);
      ctx.lineTo(175, 120);
      ctx.stroke();
      ctx.fillText('Chest: 104cm', 100, 135);

      // Measurement lines (Sleeve)
      ctx.beginPath();
      ctx.moveTo(150, 40);
      ctx.lineTo(220, 70);
      ctx.stroke();
      ctx.fillText('Sleeve: 64cm', 180, 50);

    } else if (
      category.includes('lower') ||
      category.includes('jogger') ||
      category.includes('nikker')
    ) {
      // Draw Trouser Pattern CAD layout
      ctx.moveTo(70, 40);  // Waist left
      ctx.lineTo(180, 40); // Waist right
      ctx.lineTo(190, 80); // Hip right
      ctx.lineTo(165, 270); // Cuff right bottom
      ctx.lineTo(130, 270); // Ankle right inner
      ctx.lineTo(125, 130); // Crotch center
      ctx.lineTo(120, 270); // Ankle left inner
      ctx.lineTo(85, 270);  // Cuff left bottom
      ctx.lineTo(60, 80);   // Hip left
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Waist Measurement
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(70, 30);
      ctx.lineTo(180, 30);
      ctx.stroke();
      ctx.fillStyle = '#e11d48';
      ctx.font = '9px Inter';
      ctx.fillText('Waist: 82cm', 105, 25);

      // Outseam Length Measurement
      ctx.beginPath();
      ctx.moveTo(200, 40);
      ctx.lineTo(200, 270);
      ctx.stroke();
      ctx.fillText('Length: 102cm', 205, 160);

    } else if (
      category.includes('jacket') ||
      category.includes('windcheater') ||
      category.includes('track')
    ) {
      // Draw Coat Pattern
      ctx.moveTo(80, 40);
      ctx.lineTo(170, 40);
      ctx.lineTo(230, 75);
      ctx.lineTo(210, 130);
      ctx.lineTo(180, 110);
      ctx.lineTo(185, 280);
      ctx.lineTo(65, 280);
      ctx.lineTo(70, 110);
      ctx.lineTo(40, 130);
      ctx.lineTo(20, 75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Length Measurement
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, 40);
      ctx.lineTo(60, 280);
      ctx.stroke();
      ctx.fillStyle = '#e11d48';
      ctx.font = '9px Inter';
      ctx.fillText('Back Length: 84cm', 5, 160);

      // Chest width
      ctx.beginPath();
      ctx.moveTo(70, 130);
      ctx.lineTo(180, 130);
      ctx.stroke();
      ctx.fillText('Width: 110cm', 105, 145);
    } else {
      // Default: Simple Fabric Sheet
      ctx.rect(50, 40, 150, 200);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#e11d48';
      ctx.font = '9px Inter';
      ctx.fillText('Standard Size template', 80, 120);
    }

    // Overlay grid tags
    ctx.fillStyle = '#64748b';
    ctx.font = '7px monospace';
    ctx.fillText('CAD blue-print rendering 2.0v', 5, 290);
  }, [selectedDesign]);

  const handleApprove = () => {
    if (!selectedDesign) return;
    onUpdateStatus(selectedDesign.id, 'Approved');
    setRevisionComments('');

    // Auto-select next item if available
    const nextPending = pendingDesigns.find(d => d.id !== selectedDesign.id);
    setSelectedId(nextPending ? nextPending.id : null);
  };

  const handleReject = () => {
    if (!selectedDesign) return;
    if (!revisionComments.trim()) {
      setValidationError('Please enter revision comments details before requesting changes.');
      return;
    }
    setValidationError('');
    onUpdateStatus(selectedDesign.id, 'Rejected', revisionComments);
    setRevisionComments('');

    // Auto-select next item if available
    const nextPending = pendingDesigns.find(d => d.id !== selectedDesign.id);
    setSelectedId(nextPending ? nextPending.id : null);
  };

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '22px', fontWeight: '700' }}>Verification</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}></p>
      </div>

      {pendingDesigns.length === 0 ? (
        <div className="panel" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--success-light)', color: 'var(--success)', marginBottom: '16px' }}>
            <ShieldCheck size={36} />
          </div>
          <h3 style={{ fontFamily: 'var(--font-family-title)', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>QA Verification Queue Clear!</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '450px', margin: '0 auto' }}>
            All garment designs have been successfully reviewed and approved. To add more items, create a design request in the <strong>Design</strong> tab.
          </p>
        </div>
      ) : (
        <div className="split-view">
          {/* Left Column: Pending Designs List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="panel" style={{ padding: '18px' }}>
              <h3 style={{ fontFamily: 'var(--font-family-title)', fontSize: '15px', fontWeight: '600', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Pending Review List ({pendingDesigns.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendingDesigns.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={`form-input cursor-pointer`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: selectedId === d.id ? 'var(--accent-light)' : 'var(--bg-primary)',
                      border: selectedId === d.id ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius-md)'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lot No</span>
                      <h4 style={{ fontSize: '18px', fontWeight: '800', margin: '0', fontFamily: 'var(--font-family-title)', color: 'var(--accent-color)' }}>{d.id}</h4>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.category}</span>
                    </div>
                    <span className={`status-badge ${d.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: CAD Visualizer & Review Form */}
          {selectedDesign && (
            <div className="panel animate-scale" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="panel-header" style={{ marginBottom: 0 }}>
                <h3 className="panel-title">
                  <CheckSquare size={18} className="text-accent" />
                  BOM VERIFICATION
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lot No</span>
                  <span style={{ fontFamily: 'var(--font-family-title)', fontSize: '20px', fontWeight: '800', color: 'var(--accent-color)' }}>{selectedDesign.id}</span>
                </div>
              </div>

              {/* Design CAD canvas + spec list inside a sub split layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Visualizer Canvas */}
                <div className="canvas-wrapper">
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}> GARMENT DESIGN</span>
                  <canvas
                    ref={canvasRef}
                    width="250"
                    height="300"
                    className="pattern-canvas"
                  />
                </div>

                {/* Specs list */}
                <div>
                  <h4 style={{ fontFamily: 'var(--font-family-title)', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Garment Specifications</h4>
                  <div className="spec-list" style={{ gap: '6px' }}>
                    {selectedDesign.brand && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Brand</span>
                        <span className="spec-value" style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{selectedDesign.brand}</span>
                      </div>
                    )}
                    {selectedDesign.style && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Style Code</span>
                        <span className="spec-value" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{selectedDesign.style}</span>
                      </div>
                    )}
                    {selectedDesign.lotNo2 && selectedDesign.lotNo2 !== 'N/A' && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Lot No 2</span>
                        <span className="spec-value">{selectedDesign.lotNo2}</span>
                      </div>
                    )}
                    <div className="spec-item" style={{ padding: '4px 0' }}>
                      <span className="spec-label">Category</span>
                      <span className="spec-value">{selectedDesign.category}</span>
                    </div>
                    {selectedDesign.section && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Section</span>
                        <span className="spec-value">{selectedDesign.section}</span>
                      </div>
                    )}
                    {selectedDesign.season && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Season</span>
                        <span className="spec-value">{selectedDesign.season}</span>
                      </div>
                    )}
                    <div className="spec-item" style={{ padding: '4px 0' }}>
                      <span className="spec-label">Sizes</span>
                      <span className="spec-value">{selectedDesign.targetSizes}</span>
                    </div>
                    <div className="spec-item" style={{ padding: '4px 0' }}>
                      <span className="spec-label">Fabric</span>
                      <span className="spec-value">{selectedDesign.fabricType}</span>
                    </div>
                    {selectedDesign.tapeLace && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Tape/Lace</span>
                        <span className="spec-value">{selectedDesign.tapeLace}</span>
                      </div>
                    )}
                    {selectedDesign.bottomType && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Bottom Type</span>
                        <span className="spec-value">{selectedDesign.bottomType}</span>
                      </div>
                    )}
                    {selectedDesign.zip && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Zip</span>
                        <span className="spec-value">{selectedDesign.zip}</span>
                      </div>
                    )}
                    {selectedDesign.sticker && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Sticker</span>
                        <span className="spec-value">{selectedDesign.sticker}</span>
                      </div>
                    )}
                    {selectedDesign.collar && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Collar</span>
                        <span className="spec-value">{selectedDesign.collar}</span>
                      </div>
                    )}
                    {selectedDesign.bone && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Bone</span>
                        <span className="spec-value">{selectedDesign.bone}</span>
                      </div>
                    )}
                    {selectedDesign.fullBaju && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Full Baju</span>
                        <span className="spec-value">{selectedDesign.fullBaju}</span>
                      </div>
                    )}
                    {selectedDesign.totalCost > 0 && (
                      <div className="spec-item" style={{ padding: '4px 0' }}>
                        <span className="spec-label">Unit BOM Cost</span>
                        <span className="spec-value" style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>
                          {currencySymbol}{selectedDesign.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Accessories brief list */}
                  <div style={{ marginTop: '16px' }}>
                    <h5 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>Garment Accessories BOM</h5>
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '8px' }}>
                      {selectedDesign.bom && selectedDesign.bom.map((b, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--bg-primary)', marginBottom: '4px', fontSize: '12px' }}>
                          <div>
                            <span style={{ fontWeight: '600' }}>{b.name}</span>
                            {b.detail && <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>{b.detail}</span>}
                          </div>
                          <span className={`status-badge ${String(b.status).toLowerCase() === 'yes' ? 'verified' : 'rejected'}`} style={{ padding: '2px 8px', fontSize: '10px' }}>
                            {b.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Revision history check / Action Forms */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                {selectedDesign.status === 'Rejected' && (
                  <div style={{ display: 'flex', gap: '8px', padding: '12px', backgroundColor: 'var(--danger-light)', borderRadius: '8px', border: '1px solid var(--danger)', marginBottom: '16px', color: 'var(--danger)', fontSize: '13px' }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <span style={{ fontWeight: 'bold' }}>Rejected for Revision:</span> {selectedDesign.comments}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">QA Review Comments / Revision Request Note</label>
                  {validationError && (
                    <div style={{
                      color: 'var(--danger)',
                      fontSize: '12px',
                      fontWeight: '600',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AlertTriangle size={14} />
                      <span>{validationError}</span>
                    </div>
                  )}
                  <textarea
                    rows="3"
                    className="form-input"
                    placeholder="Provide detailed comments on collar specifications, sleeve hems, pattern sizing details, or trim adjustments..."
                    value={revisionComments}
                    onChange={(e) => {
                      setRevisionComments(e.target.value);
                      if (validationError) setValidationError('');
                    }}
                    style={{
                      resize: 'vertical',
                      minHeight: '60px',
                      border: validationError ? '1.5px solid var(--danger)' : '1px solid var(--border-color)',
                      boxShadow: validationError ? '0 0 0 2px var(--danger-light)' : 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="btn btn-danger" onClick={handleReject}>
                    <X size={16} /> Request Revision
                  </button>
                  <button className="btn btn-success" onClick={handleApprove}>
                    <Check size={16} /> Verify & Approve Design
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
