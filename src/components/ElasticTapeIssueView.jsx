import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText, Search, Plus, Download, Printer, RefreshCw,
  CheckCircle, AlertTriangle, Layers, X, Calendar, User,
  Scissors, Sliders, Calculator, Zap, ArrowRight, Table,
  ShieldCheck, Lock, ExternalLink, Ruler, Edit2, MapPin, Tag,
  Box, Package, Scale, Filter, Eye, Check, Clock, ChevronDown,
  ArrowUpDown, Trash2, ArrowUpRight, CheckCheck, Database,
  TrendingDown, Sparkles
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBackendUrl } from '../utils/api';
import { getCleanImageUrl } from '../utils/designHelpers';
import SmartSelectWithManual from './SmartSelectWithManual';

// ── Searchable Material Selector with Photos, Badges, Stock & Locations ──────
function SearchableMaterialSelect({
  materials = [],
  value = '',
  onChange,
  disabled = false,
  placeholder = "-- Select Material --",
  componentHint = '',
  recommendedMaterials = [],
  reqQty = 0,
  onPreviewPhoto = () => {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 320, isAbove: false });
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  const recIdSet = useMemo(() => new Set((recommendedMaterials || []).map(m => String(m.id))), [recommendedMaterials]);
  const isRecommended = (m) => recIdSet.has(String(m.id));

  const selectedMaterial = (materials || []).find(m => String(m.id) === String(value));

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const isAbove = spaceBelow < 280 && rect.top > 280;
      const desiredWidth = Math.min(680, Math.max(rect.width, 540));
      setCoords({
        top: isAbove ? rect.top : rect.bottom + 4,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - desiredWidth - 12)),
        width: desiredWidth,
        isAbove
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleReposition = () => updateCoords();
      window.addEventListener('resize', handleReposition);
      window.addEventListener('scroll', handleReposition, true);
      return () => {
        window.removeEventListener('resize', handleReposition);
        window.removeEventListener('scroll', handleReposition, true);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (materials || [])
      .filter(m => {
        if (!q) return true;
        const itemCodeStr = String(m.itemCode || m.id || '').toLowerCase();
        const nameStr = String(m.name || '').toLowerCase();
        const colorStr = String(m.color || '').toLowerCase();
        const catStr = String(m.category || '').toLowerCase();
        const locStr = String(m.location || '').toLowerCase();
        return itemCodeStr.includes(q) || nameStr.includes(q) || colorStr.includes(q) || catStr.includes(q) || locStr.includes(q);
      })
      .sort((a, b) => {
        // 1. Recommended items float to the very top
        const aRec = isRecommended(a) ? 1 : 0;
        const bRec = isRecommended(b) ? 1 : 0;
        if (bRec !== aRec) return bRec - aRec;

        // 2. Sufficient stock items float next
        const aSuff = reqQty > 0 && (a.stock || 0) >= reqQty ? 1 : 0;
        const bSuff = reqQty > 0 && (b.stock || 0) >= reqQty ? 1 : 0;
        if (bSuff !== aSuff) return bSuff - aSuff;

        // 3. Stock quantity descending
        return (Number(b.stock) || 0) - (Number(a.stock) || 0);
      });
  }, [materials, searchQuery, recIdSet, reqQty]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Button */}
      <div
        onClick={() => {
          if (disabled) return;
          if (!isOpen) {
            updateCoords();
            setSearchQuery('');
          }
          setIsOpen(!isOpen);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: '100%',
          minHeight: '44px',
          padding: '6px 12px',
          borderRadius: '10px',
          border: '1.5px solid',
          borderColor: isOpen ? '#2563eb' : '#cbd5e1',
          background: disabled ? '#f1f5f9' : '#ffffff',
          color: selectedMaterial ? '#0f172a' : '#64748b',
          fontSize: '13px',
          fontWeight: '500',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
          boxSizing: 'border-box',
          gap: '8px'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflow: 'hidden',
          flex: 1,
          minWidth: 0
        }}>
          {selectedMaterial ? (
            <>
              {/* Photo thumbnail */}
              {(() => {
                const rawImg = selectedMaterial.imageUrl || selectedMaterial.image || selectedMaterial.photo;
                const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';
                return cleanImg ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreviewPhoto(cleanImg);
                    }}
                    title="Click to view & zoom photo"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      cursor: 'zoom-in',
                      border: '1.5px solid #cbd5e1',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <img src={cleanImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #e2e8f0',
                    flexShrink: 0,
                    color: '#94a3b8'
                  }}>
                    <Package size={16} />
                  </div>
                );
              })()}

              <span style={{
                fontFamily: 'monospace',
                fontWeight: '800',
                fontSize: '11px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                padding: '2px 6px',
                borderRadius: '4px',
                flexShrink: 0
              }}>
                {selectedMaterial.itemCode || selectedMaterial.id}
              </span>

              <span style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedMaterial.name}
              </span>

              {selectedMaterial.category && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  flexShrink: 0
                }}>
                  {selectedMaterial.category}
                </span>
              )}

              {selectedMaterial.color && selectedMaterial.color !== 'Default' && (
                <span style={{ fontSize: '11px', color: '#64748b', flexShrink: 0 }}>
                  ({selectedMaterial.color})
                </span>
              )}

              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                color: (selectedMaterial.stock || 0) >= reqQty ? '#16a34a' : '#dc2626',
                backgroundColor: (selectedMaterial.stock || 0) >= reqQty ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${(selectedMaterial.stock || 0) >= reqQty ? '#bbf7d0' : '#fecaca'}`,
                padding: '1px 6px',
                borderRadius: '4px',
                flexShrink: 0
              }}>
                {selectedMaterial.stock || 0} {selectedMaterial.unit || 'Roll'} {(selectedMaterial.stock || 0) >= reqQty ? '✓' : '⚠️'}
              </span>

              {selectedMaterial.location && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: '#0369a1',
                  backgroundColor: '#e0f2fe',
                  border: '1px solid #bae6fd',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  flexShrink: 0
                }}>
                  📍 {selectedMaterial.location}
                </span>
              )}
            </>
          ) : (
            <span style={{ color: '#64748b', fontSize: '13px' }}>{placeholder}</span>
          )}
        </div>

        <ChevronDown size={16} style={{
          color: '#64748b',
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s ease',
          flexShrink: 0
        }} />
      </div>

      {/* Popover Dropdown Portal */}
      {isOpen && !disabled && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            ...(coords.isAbove
              ? { bottom: `${window.innerHeight - coords.top + 4}px` }
              : { top: `${coords.top}px` }),
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxWidth: 'calc(100vw - 24px)',
            border: '1.5px solid #cbd5e1',
            borderRadius: '10px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.08)',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            zIndex: 9999999,
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxSizing: 'border-box'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Box */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#64748b'
            }} />
            <input
              type="text"
              autoFocus
              placeholder="Search Item Code, Name, Location, Color..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                height: '36px',
                padding: '4px 8px 4px 32px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                outline: 'none',
                background: '#f8fafc',
                color: '#0f172a',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px'
          }}>
            <div
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearchQuery('');
              }}
              style={{
                padding: '7px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                borderRadius: '6px',
                color: '#64748b',
                fontStyle: 'italic',
                backgroundColor: value === '' ? 'rgba(99,102,241,0.1)' : 'transparent'
              }}
            >
              -- Clear / Select Material --
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '12px 10px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                No materials found matching "{searchQuery}"
              </div>
            ) : (
              <>
                {/* Upper Recommended Component Header */}
                {filtered.some(m => isRecommended(m)) && (
                  <div style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#3730a3',
                    backgroundColor: '#eef2ff',
                    borderRadius: '6px',
                    border: '1px solid #c7d2fe',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}>
                    <Sparkles size={13} style={{ color: '#4f46e5' }} />
                    <span>RECOMMENDED FOR: <strong style={{ color: '#312e81', fontWeight: '800' }}>{componentHint || 'THIS ISSUE'}</strong></span>
                  </div>
                )}

                {filtered.map((m, mIdx) => {
                  const isSelected = String(m.id) === String(value);
                  const isRec = isRecommended(m);
                  const prevIsRec = mIdx > 0 ? isRecommended(filtered[mIdx - 1]) : false;
                  const showRecSeparator = mIdx > 0 && !isRec && prevIsRec;
                  const hasSuffStock = reqQty > 0 ? (m.stock || 0) >= reqQty : true;

                  const rawImg = m.imageUrl || m.image || m.photo;
                  const cleanImg = rawImg ? getCleanImageUrl(rawImg) : '';

                  return (
                    <React.Fragment key={m.id}>
                      {showRecSeparator && (
                        <div style={{
                          padding: '8px 10px 4px 10px',
                          fontSize: '10.5px',
                          fontWeight: '800',
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          borderTop: '1px solid #e2e8f0',
                          marginTop: '4px',
                          marginBottom: '2px'
                        }}>
                          ALL OTHER MATERIALS
                        </div>
                      )}

                      <div
                        onClick={() => {
                          onChange(m.id);
                          setIsOpen(false);
                          setSearchQuery('');
                        }}
                        style={{
                          padding: '7px 10px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isSelected
                            ? '#2563eb'
                            : isRec
                            ? '#eff6ff'
                            : '#ffffff',
                          color: isSelected ? '#ffffff' : '#0f172a',
                          fontWeight: isSelected || isRec ? '700' : '400',
                          transition: 'background-color 0.15s ease',
                          gap: '10px',
                          border: isSelected
                            ? '1px solid #2563eb'
                            : isRec
                            ? '1px solid #bfdbfe'
                            : '1px solid #f1f5f9',
                          borderLeft: isRec && !isSelected ? '3px solid #2563eb' : undefined,
                          marginBottom: '2px'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = isRec ? '#dbeafe' : '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = isRec ? '#eff6ff' : '#ffffff';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                          {/* Photo Thumbnail with Zoom-to-verify click */}
                          {cleanImg ? (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                onPreviewPhoto(cleanImg);
                              }}
                              title="Click to view & zoom photo"
                              style={{
                                position: 'relative',
                                width: '36px',
                                height: '36px',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                border: isSelected ? '1.5px solid #ffffff' : '1.5px solid #cbd5e1',
                                backgroundColor: '#f8fafc',
                                flexShrink: 0,
                                cursor: 'zoom-in',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <img
                                src={cleanImg}
                                alt=""
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                              <div style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                                color: '#ffffff',
                                width: '12px',
                                height: '12px',
                                borderRadius: '3px 0 0 0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '8px',
                                pointerEvents: 'none'
                              }}>
                                🔍
                              </div>
                            </div>
                          ) : (
                            <div style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '6px',
                              backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: isSelected ? 'none' : '1px solid #e2e8f0',
                              flexShrink: 0,
                              color: isSelected ? '#ffffff' : '#94a3b8'
                            }}>
                              <Package size={16} />
                            </div>
                          )}

                          {/* Item Code Badge */}
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            fontSize: '11px',
                            backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                            color: isSelected ? '#ffffff' : '#0f172a',
                            border: isSelected ? 'none' : '1px solid #e2e8f0',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            flexShrink: 0
                          }}>
                            {m.itemCode || m.id}
                          </span>

                          {/* Material Name */}
                          <span style={{
                            fontWeight: isSelected ? '700' : '600',
                            fontSize: '12.5px',
                            color: isSelected ? '#ffffff' : '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                            minWidth: 0
                          }}>
                            {m.name}
                          </span>

                          {/* Category Badge */}
                          {m.category && (
                            <span style={{
                              fontSize: '9.5px',
                              fontWeight: '700',
                              letterSpacing: '0.04em',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              flexShrink: 0,
                              textTransform: 'uppercase',
                              backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                              color: isSelected ? '#ffffff' : '#334155',
                              border: isSelected ? 'none' : '1px solid #cbd5e1'
                            }}>
                              {m.category}
                            </span>
                          )}

                          {/* Recommended Badge */}
                          {isRec && !isSelected && (
                            <span style={{
                              fontSize: '9px',
                              fontWeight: '800',
                              color: '#4338ca',
                              backgroundColor: '#e0e7ff',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              flexShrink: 0,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              border: '1px solid #c7d2fe'
                            }}>
                              ✨ RECOMMENDED
                            </span>
                          )}
                        </div>

                        {/* Right: Stock and Location */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0, marginLeft: '6px' }}>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '800',
                            color: isSelected ? '#ffffff' : hasSuffStock ? '#16a34a' : '#dc2626'
                          }}>
                            {m.stock || 0} {m.unit || 'Roll'} {hasSuffStock ? '' : '(Low)'}
                          </span>

                          {m.location && (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '600',
                              color: isSelected ? 'rgba(255,255,255,0.9)' : '#0284c7',
                              backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(2,132,199,0.08)',
                              border: isSelected ? 'none' : '1px solid rgba(2,132,199,0.2)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap'
                            }}>
                              📍 {m.location.split(',')[0].trim()}
                            </span>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function ElasticTapeIssueView({
  materials = [],
  onIssueMaterials = () => {},
  onUpdateMaterial = () => {},
  syncMaterialsToDb = () => {},
  currentUser = null,
  currencySymbol = '₹',
  designs = [],
  prefilledLotNo = '',
  onNavigate = () => {}
}) {
  // Navigation / View state
  const [activeTab, setActiveTab] = useState('all_parchis'); // 'all_parchis' | 'direct_issue' | 'quick_generate'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'elastic' | 'tape' | 'bone' | 'both'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'issued'
  const [searchQuery, setSearchQuery] = useState(prefilledLotNo || '');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'bill_no' | 'lot_no'

  // Data states
  const [elasticRecords, setElasticRecords] = useState([]);
  const [boneRecords, setBoneRecords] = useState([]);
  const [issueLogs, setIssueLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Real Material Issued State Map (tracks which bills have actually had real store stock deducted)
  const [realIssuedMap, setRealIssuedMap] = useState(() => {
    try {
      const saved = localStorage.getItem('gpdms_real_material_issued_bills');
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });

  // Modal / Drawer states
  const [selectedBill, setSelectedBill] = useState(null); // for viewing bill detail
  const [issueModalBill, setIssueModalBill] = useState(null); // for issuing actual material
  const [isIssuing, setIsIssuing] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null); // for photo verification zoom preview
  const [matSearchQuery, setMatSearchQuery] = useState(''); // fast search within materials

  // Direct Issue by Bill No Top Selector State
  const [quickBillSearch, setQuickBillSearch] = useState('');
  const [selectedQuickBillNo, setSelectedQuickBillNo] = useState('');

  // Quick Generator State
  const [genType, setGenType] = useState('elastic'); // 'elastic' | 'tape' | 'bone' | 'both'
  const [genLotNo, setGenLotNo] = useState('');
  const [genIsWithoutLot, setGenIsWithoutLot] = useState(false);
  const [genPcs, setGenPcs] = useState('');
  const [genStyle, setGenStyle] = useState('Lower / Tracksuit');
  const [genElasticSize, setGenElasticSize] = useState('50');
  const [genElasticUnit, setGenElasticUnit] = useState('inch');
  const [genElasticWidth, setGenElasticWidth] = useState('1 Inch (Standard)');
  const [genTapeSize, setGenTapeSize] = useState('62');
  const [genTapeUnit, setGenTapeUnit] = useState('cm');
  const [genTapeWidth, setGenTapeWidth] = useState('0.5 Inch (Standard)');
  const [genBoneWidth, setGenBoneWidth] = useState('1.5 Inch (Standard)');
  const [genBoneWeightKg, setGenBoneWeightKg] = useState('2.50');
  const [genBoneRolls, setGenBoneRolls] = useState(1);
  const [genReceiver, setGenReceiver] = useState('');
  const [genSupervisor, setGenSupervisor] = useState('ROHIT / MONU');
  const [genRemarks, setGenRemarks] = useState('');
  const [generating, setGenerating] = useState(false);
  const [autoOpenIssueAfterGen, setAutoOpenIssueAfterGen] = useState(true);

  // Issue Actual Real Material Form State
  const [issueForm, setIssueForm] = useState({
    elasticMaterialId: '',
    tapeMaterialId: '',
    boneMaterialId: '',
    customElasticQty: '',
    customTapeQty: '',
    customBoneQty: '',
    receiverName: '',
    receiverDept: 'CUTTING',
    notes: ''
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Play audio chime on successful real issue
  const playVictorySound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (_) {}
  };

  // ── Fetch All Records from DB ─────────────────────────────────────────────
  const fetchAllParchis = async () => {
    setLoading(true);
    try {
      // 1. Fetch Elastic Issues
      let elastics = [];
      try {
        const resEl = await fetch(`${getBackendUrl()}/api/elastic-issues`);
        if (resEl.ok) {
          const data = await resEl.json();
          if (Array.isArray(data)) elastics = data;
        }
      } catch (e) {
        console.warn('Error fetching elastic issues:', e);
      }

      // 2. Fetch Bone Issues
      let bones = [];
      try {
        const resBn = await fetch(`${getBackendUrl()}/api/bone-issues`);
        if (resBn.ok) {
          const data = await resBn.json();
          if (Array.isArray(data)) bones = data;
        }
      } catch (e) {
        console.warn('Error fetching bone issues:', e);
      }

      // 3. Fetch Issue Logs
      let logs = [];
      try {
        const resLogs = await fetch(`${getBackendUrl()}/api/issue-logs`);
        if (resLogs.ok) {
          const data = await resLogs.json();
          if (Array.isArray(data)) logs = data;
        }
      } catch (e) {
        console.warn('Error fetching issue logs:', e);
      }

      // 4. Fallback from localStorage
      if (elastics.length === 0) {
        try {
          const localEl = localStorage.getItem('gpdms_elastic_issue_history');
          if (localEl) elastics = JSON.parse(localEl);
        } catch (_) {}
      }
      if (bones.length === 0) {
        try {
          const localBn = localStorage.getItem('gpdms_bone_issue_history');
          if (localBn) bones = JSON.parse(localBn);
        } catch (_) {}
      }

      // Also ingest legacy issue_logs that represent elastic or bone slips
      logs.forEach(l => {
        const idUpper = String(l.id || '').toUpperCase();
        const catUpper = String(l.category || '').toUpperCase();
        if (
          idUpper.startsWith('ELASTIC') ||
          idUpper.startsWith('TAPE') ||
          idUpper.startsWith('BONE') ||
          idUpper.startsWith('REAL-MI-') ||
          catUpper.includes('ELASTIC') ||
          catUpper.includes('BONE') ||
          catUpper.includes('TAPE')
        ) {
          // If not in elastics or bones, add as synthetic record
          if (!elastics.some(e => (e.slipNo || e.slip_no) === l.id) && !bones.some(b => (b.slipNo || b.slip_no) === l.id)) {
            let mats = [];
            try {
              mats = typeof l.materials === 'string' ? JSON.parse(l.materials) : (l.materials || []);
            } catch (_) {}
            const firstMat = mats[0] || {};
            const matBomUpper = String(firstMat.bomItemName || '').toUpperCase();
            const matNameUpper = String(firstMat.name || '').toUpperCase();
            const matBillUpper = String(firstMat.billNo || '').toUpperCase();

            const isBone = idUpper.includes('BONE') || catUpper.includes('BONE') || matBomUpper.includes('BONE') || matNameUpper.includes('BONE') || matBillUpper.includes('BONE');
            const isTape = idUpper.includes('TAPE') || catUpper.includes('TAPE') || matBomUpper.includes('TAPE') || matNameUpper.includes('TAPE') || matBillUpper.includes('TAPE');
            const isOther = idUpper.includes('OTHER') || catUpper.includes('OTHER') || matBomUpper.includes('OTHER');

            const deductedItems = Array.isArray(mats) ? mats.map(m => ({
              materialName: m.name || m.materialName || 'Store Material',
              materialId: m.materialId || '',
              bomItemName: m.bomItemName || '',
              totalRequired: m.qty ?? m.totalRequired ?? 1,
              unit: m.unit || 'Roll',
              location: m.location || 'Main Store'
            })) : [];

            if (isBone) {
              const bRolls = firstMat.unit?.toLowerCase().includes('roll')
                ? (parseFloat(firstMat.qty) || 1)
                : (l.volume && l.volume <= 100 ? l.volume : 1);
              const bWeight = firstMat.unit?.toLowerCase().includes('kg')
                ? firstMat.qty
                : (firstMat.weight || (parseFloat(bRolls) * 2.5).toFixed(2));

              // Fallback piece detection: from volume or regex from id/billNo
              const fallbackPcsMatch = String(l.id).match(/-w\/o-(\d+)/i) || String(firstMat.billNo || '').match(/-w\/o-(\d+)/i);
              const volNum = parseInt(l.volume || 0, 10);
              const qtyPcs = volNum > 100 ? volNum : (fallbackPcsMatch ? parseInt(fallbackPcsMatch[1], 10) : (volNum > 0 ? volNum : 0));

              bones.push({
                id: l.id,
                slipNo: l.id,
                lotNo: l.lotId || 'Direct Floor',
                date: l.date,
                rolls: bRolls,
                issuerName: l.personName,
                receiverName: l.receiverName,
                remarks: '',
                payload: JSON.stringify({
                  boneWeightKg: bWeight,
                  rolls: bRolls,
                  boneRolls: bRolls,
                  boneWidth: firstMat.width || '1.5 Inch (Standard)',
                  boneMaterialName: firstMat.name || 'Bone Chinese (Beige)',
                  selectedBoneMaterialId: firstMat.materialId || 'ST00346',
                  location: firstMat.location || 'Main Store - RACK 208',
                  quantity: qtyPcs,
                  issuePcs: qtyPcs,
                  deductedItems
                })
              });
            } else if (isTape) {
              const tRolls = firstMat.unit?.toLowerCase().includes('roll') ? (parseFloat(firstMat.qty) || 1) : Math.ceil((l.volume || 1) / 45);
              const tMtr = firstMat.unit?.toLowerCase().includes('mtr') ? (parseFloat(firstMat.qty) || 0) : (firstMat.totalTapeMtr || 0);
              const fallbackPcsMatch = String(l.id).match(/-w\/o-(\d+)/i) || String(firstMat.billNo || '').match(/-w\/o-(\d+)/i);
              const volNum = parseInt(l.volume || 0, 10);
              const qtyPcs = volNum > 100 ? volNum : (fallbackPcsMatch ? parseInt(fallbackPcsMatch[1], 10) : (volNum > 0 ? volNum : 0));

              elastics.push({
                id: l.id,
                slipNo: l.id,
                lotNo: l.lotId || 'Direct Floor',
                date: l.date,
                rolls: tRolls,
                issuerName: l.personName,
                receiverName: l.receiverName,
                remarks: '',
                payload: JSON.stringify({
                  materialMode: 'tape',
                  tapeWidth: firstMat.width || '0.5 Inch (Standard)',
                  tapeRolls: tRolls,
                  totalTapeMtr: tMtr,
                  quantity: qtyPcs,
                  issuePcs: qtyPcs,
                  deductedItems
                })
              });
            } else if (isOther) {
              const oRolls = parseFloat(firstMat.qty || l.volume || 1);
              elastics.push({
                id: l.id,
                slipNo: l.id,
                lotNo: l.lotId || 'Direct Floor',
                date: l.date,
                rolls: oRolls,
                issuerName: l.personName,
                receiverName: l.receiverName,
                remarks: '',
                payload: JSON.stringify({
                  materialMode: 'other',
                  otherMaterialName: firstMat.name || 'Other Accessory',
                  otherUnit: firstMat.unit || 'Roll',
                  otherRollCount: oRolls,
                  quantity: parseInt(l.volume || 0, 10),
                  issuePcs: parseInt(l.volume || 0, 10),
                  deductedItems
                })
              });
            } else {
              elastics.push({
                id: l.id,
                slipNo: l.id,
                lotNo: l.lotId || 'Direct Floor',
                date: l.date,
                rolls: l.volume || firstMat.rolls || 1,
                issuerName: l.personName,
                receiverName: l.receiverName,
                remarks: '',
                payload: JSON.stringify({
                  materialMode: 'elastic',
                  totalElasticMtr: firstMat.totalElasticMtr || (firstMat.unit?.toLowerCase().includes('mtr') ? firstMat.qty : 0),
                  elasticPerPcMtr: firstMat.elasticPerPcMtr || 0,
                  elasticWidth: firstMat.width || '1 Inch',
                  shade: firstMat.shade || '',
                  selectedElasticMaterialId: firstMat.materialId || '',
                  quantity: parseInt(l.volume || 0, 10),
                  issuePcs: parseInt(l.volume || 0, 10),
                  deductedItems
                })
              });
            }
          }
        }
      });

      setElasticRecords(elastics);
      setBoneRecords(bones);
      setIssueLogs(logs);
    } catch (err) {
      console.error('Failed to load all parchis:', err);
      showToast('Failed to load records. Check connection.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllParchis();
  }, []);

  // Update search query when prefilledLotNo changes
  useEffect(() => {
    if (prefilledLotNo) {
      setSearchQuery(prefilledLotNo);
    }
  }, [prefilledLotNo]);

  // ── Unified Parchi / Bill Normalizer ──────────────────────────────────────
  const normalizedParchis = useMemo(() => {
    const list = [];

    const parsePayload = (raw) => {
      if (!raw) return {};
      if (typeof raw === 'object') return raw;
      try {
        return JSON.parse(raw);
      } catch (_) {
        return {};
      }
    };

    // Helper: Strict check if REAL MATERIAL has been deducted from store inventory
    const checkRealMaterialIssueStatus = (billNo, payloadObj, remarksStr) => {
      const bKey = String(billNo || '').trim();

      // 1. Check in realIssuedMap (localStorage & live state)
      if (realIssuedMap[bKey] && realIssuedMap[bKey].isIssued) {
        const item = realIssuedMap[bKey];
        return {
          isIssued: true,
          issuedAt: item.issuedAt,
          issuedBy: item.issuedBy,
          issuedMat: item.issuedMaterialName,
          deductedQty: item.deductedQty,
          unit: item.unit,
          deductedItems: item.deductedItems || []
        };
      }

      // 2. Check in database payload explicitly marked as realMaterialIssued
      if (payloadObj && payloadObj.realMaterialIssued) {
        return {
          isIssued: true,
          issuedAt: payloadObj.issuedAt,
          issuedBy: payloadObj.issuedBy,
          issuedMat: payloadObj.issuedMaterialName,
          deductedQty: payloadObj.deductedQty,
          unit: payloadObj.unit,
          deductedItems: payloadObj.deductedItems || []
        };
      }

      // 3. Check if remarks has explicit [ACTUAL_STOCK_DEDUCTED: ...] tag
      if (remarksStr && String(remarksStr).includes('[ACTUAL_STOCK_DEDUCTED:')) {
        return {
          isIssued: true,
          issuedAt: 'Completed',
          issuedBy: 'Store Incharge',
          issuedMat: 'Real Inventory Stock Deducted',
          deductedItems: payloadObj?.deductedItems || []
        };
      }

      // 4. Check if issue_logs has a dedicated REAL issue entry (e.g. ID starting with REAL-MI-)
      const realLog = issueLogs.find(l =>
        String(l.id || '').toUpperCase().startsWith('REAL-MI-') &&
        (String(l.id || '').toUpperCase().includes(String(billNo).toUpperCase()) ||
         (Array.isArray(l.materials) && l.materials.some(m => String(m.billNo || '').toUpperCase() === String(billNo).toUpperCase())))
      );
      if (realLog) {
        let mats = [];
        try {
          mats = typeof realLog.materials === 'string' ? JSON.parse(realLog.materials) : (realLog.materials || []);
        } catch (_) {}
        const deductedItems = Array.isArray(mats) ? mats.map(m => ({
          materialName: m.name || m.materialName || 'Store Material',
          materialId: m.materialId || '',
          bomItemName: m.bomItemName || '',
          totalRequired: m.qty ?? m.totalRequired ?? 1,
          unit: m.unit || 'Roll',
          location: m.location || 'Main Store'
        })) : [];

        return {
          isIssued: true,
          issuedAt: realLog.date,
          issuedBy: realLog.personName,
          issuedMat: deductedItems.length > 0
            ? deductedItems.map(m => `${m.materialName} (${m.totalRequired} ${m.unit})`).join(', ')
            : (Array.isArray(realLog.materials) ? realLog.materials.map(m => m.name).join(', ') : 'Stock Deducted'),
          deductedItems
        };
      }

      // 5. If this record itself IS a REAL-MI- record, it is already deducted!
      if (String(billNo || '').toUpperCase().startsWith('REAL-MI-')) {
        return {
          isIssued: true,
          issuedAt: payloadObj?.issuedAt || 'Completed',
          issuedBy: payloadObj?.issuedBy || 'Store Incharge',
          issuedMat: payloadObj?.issuedMaterialName || 'Real Inventory Stock Deducted',
          deductedItems: payloadObj?.deductedItems || []
        };
      }

      // Otherwise, it is NOT yet issued from actual store stock!
      return { isIssued: false };
    };

    // Process Elastic & Tape Issues
    elasticRecords.forEach(rec => {
      const payload = parsePayload(rec.payload);
      const billNo = rec.slipNo || rec.slip_no || `ELS-${rec.id}`;
      const slipUpper = String(billNo).toUpperCase();

      let billType = 'elastic';
      const mMode = String(rec.materialMode || payload.materialMode || '').toLowerCase();

      if (slipUpper.includes('BONE') || mMode === 'bone') {
        billType = 'bone';
      } else if (slipUpper.includes('OTHER') || mMode === 'other') {
        billType = 'other';
      } else if (slipUpper.startsWith('ELASTIC') || mMode === 'elastic') {
        // If bill number starts with ELASTIC (e.g. elastic-w/o-34) or mode was elastic, it is ONLY ELASTIC!
        billType = 'elastic';
      } else if (slipUpper.startsWith('TAPE') || mMode === 'tape') {
        // If bill number starts with TAPE (e.g. tape-w/o-12) or mode was tape, it is ONLY TAPE!
        billType = 'tape';
      } else if (slipUpper.includes('BOTH') || mMode === 'both' || mMode === 'all') {
        billType = 'both';
      } else if (rec.totalElasticMtr > 0 && rec.totalTapeMtr > 0 && !slipUpper.includes('ELASTIC') && !slipUpper.includes('TAPE')) {
        billType = 'both';
      } else if (rec.totalTapeMtr > 0 && !rec.totalElasticMtr) {
        billType = 'tape';
      } else {
        billType = 'elastic';
      }

      const issueStatus = checkRealMaterialIssueStatus(billNo, payload, rec.remarks);
      const parsedQty = parseInt(rec.quantity || payload.quantity || payload.issuePcs || payload.cuttingQty || 0, 10);
      const fallbackPcsMatch = String(billNo).match(/-w\/o-(\d+)/i);
      const finalQty = parsedQty > 0 ? parsedQty : (fallbackPcsMatch ? parseInt(fallbackPcsMatch[1], 10) : 0);

      list.push({
        id: `elastic_${rec.id || billNo}`,
        rawId: rec.id,
        sourceTable: 'elastic_issue',
        billNo,
        slipNo: billNo,
        date: rec.issueDate || rec.issue_date || rec.date || (rec.createdAt ? rec.createdAt.split('T')[0] : '—'),
        lotNo: rec.lotNo || rec.lot_no || 'Direct Floor',
        isWithoutLot: !rec.lotNo || String(rec.lotNo).toLowerCase().includes('direct') || String(billNo).includes('-w/o-'),
        billType,
        typeLabel: billType === 'bone'
          ? 'Bone Issue'
          : billType === 'other'
            ? 'Other Accessory'
            : billType === 'tape'
              ? 'Tape Issue'
              : billType === 'both'
                ? 'Elastic & Tape'
                : 'Elastic Issue',
        style: rec.style || payload.style || 'Lower / Tracksuit',
        brand: rec.brand || payload.brand || 'Mohit Hosiery',
        garmentType: rec.garmentType || rec.garment_type || payload.garmentType || 'Lower',
        fabric: rec.fabric || payload.fabric || '—',
        quantity: finalQty,
        shade: rec.shade || payload.shade || '—',
        size: rec.size || payload.size || '—',
        // Elastic specific
        elasticWidth: rec.elasticWidth || rec.elastic_width || rec.width || payload.elasticWidth || '1 Inch',
        unitType: rec.unitType || rec.unit_type || payload.unitType || 'inch',
        elasticSizeInput: parseFloat(rec.elasticSizeInput ?? rec.elastic_size_input ?? payload.elasticSizeInput ?? 0),
        elasticPerPcMtr: parseFloat(rec.elasticPerPcMtr ?? rec.elastic_per_pc_mtr ?? payload.elasticPerPcMtr ?? 0),
        totalElasticMtr: billType === 'tape' ? 0 : parseFloat(rec.totalElasticMtr ?? rec.total_elastic_mtr ?? payload.totalElasticMtr ?? 0),
        elasticRolls: billType === 'tape' ? 0 : parseInt(rec.rolls || payload.rolls || 1, 10),
        // Tape specific
        tapeWidth: payload.tapeWidth || '0.5 Inch',
        tapeSizeInput: parseFloat(payload.tapeSizeInput || 0),
        tapePerPcMtr: parseFloat(rec.tapePerPcMtr ?? rec.tape_per_pc_mtr ?? payload.tapePerPcMtr ?? 0),
        totalTapeMtr: billType === 'elastic' ? 0 : parseFloat(rec.totalTapeMtr ?? rec.total_tape_mtr ?? payload.totalTapeMtr ?? 0),
        tapeRolls: billType === 'elastic' ? 0 : parseInt(payload.tapeRolls || 1, 10),
        // Bone specific
        boneWidth: payload.boneWidth || payload.width || rec.boneWidth || rec.width || '1.5 Inch (Standard)',
        boneWeightKg: payload.boneWeightKg || payload.weight || rec.boneWeightKg || rec.weight || '2.50',
        boneRolls: parseInt(payload.boneRolls || payload.rolls || rec.rolls || 1, 10),
        boneMaterialName: payload.boneMaterialName || 'Bone Chinese (Beige)',
        selectedBoneMaterialId: payload.selectedBoneMaterialId || 'ST00346',
        // Other specific
        otherMaterialName: payload.otherMaterialName || rec.otherMaterialName || 'Other Accessory',
        otherRollCount: parseFloat(payload.otherRollCount || rec.otherRollCount || payload.rolls || 1),
        otherUnit: payload.otherUnit || rec.otherUnit || 'Roll',

        // People
        issuerName: rec.issuerName || rec.issuer_name || 'Store Incharge',
        receiverName: rec.receiverName || rec.receiver_name || payload.receiverName || '—',
        supervisorName: rec.supervisorName || rec.supervisor_name || payload.supervisorName || 'ROHIT / MONU',
        remarks: rec.remarks || payload.remarks || '',
        payload,
        issueStatus,
        createdAt: rec.createdAt || rec.created_at || ''
      });
    });

    // Process Bone Issues
    boneRecords.forEach(rec => {
      const payload = parsePayload(rec.payload);
      const billNo = rec.slipNo || rec.slip_no || `BONE-${rec.id}`;
      const issueStatus = checkRealMaterialIssueStatus(billNo, payload, rec.remarks);
      const parsedQty = parseInt(rec.quantity || payload.quantity || payload.issuePcs || payload.cuttingQty || 0, 10);
      const fallbackPcsMatch = String(billNo).match(/-w\/o-(\d+)/i);
      const finalQty = parsedQty > 0 ? parsedQty : (fallbackPcsMatch ? parseInt(fallbackPcsMatch[1], 10) : 0);

      list.push({
        id: `bone_${rec.id || billNo}`,
        rawId: rec.id,
        sourceTable: 'bone_issue',
        billNo,
        slipNo: billNo,
        date: rec.issueDate || rec.issue_date || rec.date || (rec.createdAt ? rec.createdAt.split('T')[0] : '—'),
        lotNo: rec.lotNo || rec.lot_no || 'Direct Floor',
        isWithoutLot: !rec.lotNo || String(rec.lotNo).toLowerCase().includes('direct') || String(billNo).includes('-w/o-'),
        billType: 'bone',
        typeLabel: 'Bone Issue',
        style: rec.style || payload.style || 'Lower / Tracksuit',
        brand: rec.brand || payload.brand || 'Mohit Hosiery',
        garmentType: rec.garmentType || rec.garment_type || payload.garmentType || 'Lower',
        fabric: rec.fabric || payload.fabric || '—',
        quantity: finalQty,
        shade: rec.shade || payload.shade || '—',
        size: rec.size || payload.size || '—',
        // Bone specific
        boneWidth: payload.boneWidth || payload.width || rec.boneWidth || rec.width || '1.5 Inch (Standard)',
        boneWeightKg: payload.boneWeightKg || payload.weight || rec.boneWeightKg || rec.weight || '2.50',
        boneRolls: parseInt(payload.boneRolls || payload.rolls || rec.rolls || 1, 10),
        boneMaterialName: payload.boneMaterialName || 'Bone Chinese (Beige)',
        selectedBoneMaterialId: payload.selectedBoneMaterialId || 'ST00346',
        // People
        issuerName: rec.issuerName || rec.issuer_name || 'Store Incharge',
        receiverName: rec.receiverName || rec.receiver_name || payload.receiverName || '—',
        supervisorName: rec.supervisorName || rec.supervisor_name || payload.supervisorName || 'ROHIT / MONU',
        remarks: rec.remarks || payload.remarks || '',
        payload,
        issueStatus,
        createdAt: rec.createdAt || rec.created_at || ''
      });
    });

    return list;
  }, [elasticRecords, boneRecords, issueLogs, realIssuedMap]);

  // ── Filtered & Sorted Parchis ─────────────────────────────────────────────
  const filteredParchis = useMemo(() => {
    return normalizedParchis.filter(item => {
      // Type Filter
      if (typeFilter !== 'all') {
        if (typeFilter === 'elastic' && item.billType !== 'elastic' && item.billType !== 'both') return false;
        if (typeFilter === 'tape' && item.billType !== 'tape' && item.billType !== 'both') return false;
        if (typeFilter === 'bone' && item.billType !== 'bone') return false;
        if (typeFilter === 'both' && item.billType !== 'both') return false;
      }

      // Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'issued' && !item.issueStatus.isIssued) return false;
        if (statusFilter === 'pending' && item.issueStatus.isIssued) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchBill = String(item.billNo).toLowerCase().includes(q);
        const matchLot = String(item.lotNo).toLowerCase().includes(q);
        const matchReceiver = String(item.receiverName).toLowerCase().includes(q);
        const matchStyle = String(item.style).toLowerCase().includes(q);
        const matchSupervisor = String(item.supervisorName).toLowerCase().includes(q);
        const matchType = String(item.typeLabel).toLowerCase().includes(q);
        if (!matchBill && !matchLot && !matchReceiver && !matchStyle && !matchSupervisor && !matchType) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'seq_asc') {
        const numA = parseInt(String(a.billNo).match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(String(b.billNo).match(/\d+/)?.[0] || '0', 10);
        return (numA - numB) || String(a.billNo).localeCompare(String(b.billNo), undefined, { numeric: true });
      }
      if (sortBy === 'seq_desc') {
        const numA = parseInt(String(a.billNo).match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(String(b.billNo).match(/\d+/)?.[0] || '0', 10);
        return (numB - numA) || String(b.billNo).localeCompare(String(a.billNo), undefined, { numeric: true });
      }
      if (sortBy === 'newest') {
        return (new Date(b.date || 0)) - (new Date(a.date || 0)) || String(b.billNo).localeCompare(String(a.billNo));
      }
      if (sortBy === 'oldest') {
        return (new Date(a.date || 0)) - (new Date(b.date || 0)) || String(a.billNo).localeCompare(String(b.billNo));
      }
      if (sortBy === 'bill_no') {
        return String(a.billNo).localeCompare(String(b.billNo), undefined, { numeric: true });
      }
      if (sortBy === 'lot_no') {
        return String(a.lotNo).localeCompare(String(b.lotNo), undefined, { numeric: true });
      }
      return 0;
    });
  }, [normalizedParchis, typeFilter, statusFilter, searchQuery, sortBy]);

  // ── Metrics & Totals Calculation ──────────────────────────────────────────
  const stats = useMemo(() => {
    let totalElasticMtr = 0;
    let totalElasticRolls = 0;
    let totalTapeMtr = 0;
    let totalBoneKg = 0;
    let totalBoneRolls = 0;
    let issuedCount = 0;
    let pendingCount = 0;

    normalizedParchis.forEach(item => {
      if (item.issueStatus.isIssued) {
        issuedCount++;
      } else {
        pendingCount++;
      }

      if (item.billType === 'elastic' || item.billType === 'both') {
        totalElasticMtr += (item.totalElasticMtr || 0);
        totalElasticRolls += (item.elasticRolls || 0);
      }
      if (item.billType === 'tape' || item.billType === 'both') {
        totalTapeMtr += (item.totalTapeMtr || 0);
      }
      if (item.billType === 'bone') {
        totalBoneKg += parseFloat(item.boneWeightKg || 0);
        totalBoneRolls += (item.boneRolls || 0);
      }
    });

    return {
      totalCount: normalizedParchis.length,
      elasticCount: normalizedParchis.filter(p => p.billType === 'elastic' || p.billType === 'both').length,
      tapeCount: normalizedParchis.filter(p => p.billType === 'tape' || p.billType === 'both').length,
      boneCount: normalizedParchis.filter(p => p.billType === 'bone').length,
      totalElasticMtr: Math.round(totalElasticMtr * 100) / 100,
      totalElasticRolls,
      totalTapeMtr: Math.round(totalTapeMtr * 100) / 100,
      totalBoneKg: Math.round(totalBoneKg * 100) / 100,
      totalBoneRolls,
      issuedCount,
      pendingCount
    };
  }, [normalizedParchis]);

  // ── Store Inventory Filtered Categories ──────────────────────────────────
  const inventoryElastic = useMemo(() => {
    return (materials || []).filter(m =>
      (m.category || '').toLowerCase().includes('elastic') ||
      (m.name || '').toLowerCase().includes('elastic')
    );
  }, [materials]);

  const inventoryTape = useMemo(() => {
    return (materials || []).filter(m =>
      (m.category || '').toLowerCase().includes('tape') ||
      (m.name || '').toLowerCase().includes('tape')
    );
  }, [materials]);

  const inventoryBone = useMemo(() => {
    return (materials || []).filter(m =>
      (m.category || '').toLowerCase().includes('bone') ||
      (m.name || '').toLowerCase().includes('bone')
    );
  }, [materials]);

  // ── Smart Auto-Match Inventory Helpers (Prioritizes Sufficient Stock) ─
  const getBestElasticMaterial = (widthStr, reqQty = 0) => {
    const w = String(widthStr || '').toLowerCase();
    let candidates = inventoryElastic;
    if (w.includes('2') && !w.includes('1.5') && !w.includes('0.5')) {
      const filtered = inventoryElastic.filter(i => i.id === 'ST00428' || (i.name || '').toLowerCase().includes('2inch') || (i.name || '').toLowerCase().includes('2 inch'));
      if (filtered.length > 0) candidates = filtered;
    } else if (w.includes('1.5')) {
      const filtered = inventoryElastic.filter(i => i.id === 'ST00430' || (i.name || '').toLowerCase().includes('1.5'));
      if (filtered.length > 0) candidates = filtered;
    } else if (w.includes('1') && !w.includes('1.5') && !w.includes('2')) {
      const filtered = inventoryElastic.filter(i => i.id === 'ST00427' || (i.name || '').toLowerCase().includes('1 inch') || (i.name || '').toLowerCase().includes('1inch'));
      if (filtered.length > 0) candidates = filtered;
    }
    // 1. Prioritize candidate with sufficient live stock
    if (reqQty > 0) {
      const sufficient = candidates.filter(i => (i.stock || 0) >= reqQty);
      if (sufficient.length > 0) return sufficient[0];
    }
    const withStock = candidates.filter(i => (i.stock || 0) > 0);
    return withStock[0] || candidates[0] || inventoryElastic[0] || null;
  };

  const getBestBoneMaterial = (reqQty = 0) => {
    let candidates = inventoryBone;
    const beige = inventoryBone.filter(i => i.id === 'ST00346' || (i.name || '').toLowerCase().includes('beige'));
    if (beige.length > 0) candidates = beige;

    if (reqQty > 0) {
      const sufficient = candidates.filter(i => (i.stock || 0) >= reqQty);
      if (sufficient.length > 0) return sufficient[0];
    }
    const withStock = candidates.filter(i => (i.stock || 0) > 0);
    return withStock[0] || candidates[0] || inventoryBone[0] || null;
  };

  const getBestTapeMaterial = (widthStr, reqQty = 0) => {
    let candidates = inventoryTape;
    const w = String(widthStr || '').toLowerCase();
    if (w.includes('0.5') || w.includes('1/2')) {
      const filtered = inventoryTape.filter(i => (i.name || '').toLowerCase().includes('0.5') || (i.name || '').toLowerCase().includes('1/2'));
      if (filtered.length > 0) candidates = filtered;
    } else if (w.includes('2') && !w.includes('0.5')) {
      const filtered = inventoryTape.filter(i => (i.name || '').toLowerCase().includes('2inch') || (i.name || '').toLowerCase().includes('2 inch'));
      if (filtered.length > 0) candidates = filtered;
    }

    // 1. Prioritize candidate with sufficient live stock (e.g. 1100 Mtr or 2041 Mtr when 372 is needed)
    if (reqQty > 0) {
      const sufficient = candidates.filter(i => (i.stock || 0) >= reqQty);
      if (sufficient.length > 0) return sufficient[0];
    }
    const withStock = candidates.filter(i => (i.stock || 0) > 0);
    return withStock[0] || candidates[0] || inventoryTape[0] || null;
  };

  // ── Open Issue Actual Material Modal ──────────────────────────────────────
  const handleOpenIssueModal = (bill) => {
    setIssueModalBill(bill);
    setMatSearchQuery('');

    const isElasticBill = bill.billType === 'elastic' || bill.billType === 'both';
    const isTapeBill = bill.billType === 'tape' || bill.billType === 'both';
    const isBoneBill = bill.billType === 'bone';

    const reqElastic = isElasticBill ? (bill.elasticRolls > 0 ? bill.elasticRolls : (bill.totalElasticMtr > 0 ? bill.totalElasticMtr : 1)) : 0;
    const reqTape = isTapeBill ? (bill.totalTapeMtr > 0 ? bill.totalTapeMtr : (bill.tapeRolls || 1)) : 0;
    const reqBone = isBoneBill ? (bill.boneRolls > 0 ? bill.boneRolls : (parseFloat(bill.boneWeightKg) || 2.50)) : 0;

    const matchedElastic = isElasticBill ? getBestElasticMaterial(bill.elasticWidth, reqElastic) : null;
    const matchedTape = isTapeBill ? getBestTapeMaterial(bill.tapeWidth, reqTape) : null;
    const matchedBone = isBoneBill ? getBestBoneMaterial(reqBone) : null;

    setIssueForm({
      elasticMaterialId: matchedElastic ? matchedElastic.id : (isElasticBill ? (inventoryElastic[0]?.id || '') : ''),
      tapeMaterialId: matchedTape ? matchedTape.id : (isTapeBill ? (inventoryTape[0]?.id || '') : ''),
      boneMaterialId: matchedBone ? matchedBone.id : (isBoneBill ? (inventoryBone[0]?.id || '') : ''),
      customElasticQty: reqElastic,
      customTapeQty: reqTape,
      customBoneQty: reqBone,
      receiverName: bill.receiverName !== '—' ? bill.receiverName : 'ROHIT',
      receiverDept: 'CUTTING',
      notes: `Actual Store Issue against Bill #${bill.billNo} (Lot #${bill.lotNo})`
    });
  };

  // ── Instant Real Material Issue Core (Executes in <100ms) ────────────────
  const executeRealMaterialIssue = (bill, itemsToDeduct, receiverName = 'ROHIT', receiverDept = 'CUTTING') => {
    if (!bill || !itemsToDeduct || itemsToDeduct.length === 0) {
      showToast('No material selected to issue.', 'error');
      return;
    }

    // 1. Instant UI update & close modal immediately (0ms delay!)
    setIssueModalBill(null);
    setIsIssuing(false);
    playVictorySound();

    const issueTimestamp = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const issuedSummaryStr = itemsToDeduct.map(i => `${i.materialName} (-${i.totalRequired} ${i.unit})`).join(', ');

    const newIssuedRecord = {
      isIssued: true,
      issuedAt: issueTimestamp,
      issuedBy: currentUser?.name || 'Store Incharge',
      issuedReceiver: receiverName,
      issuedMaterialName: issuedSummaryStr,
      deductedItems: itemsToDeduct
    };

    // 2. Immediate local storage & in-memory state update
    const updatedMap = {
      ...realIssuedMap,
      [bill.billNo]: newIssuedRecord
    };
    setRealIssuedMap(updatedMap);
    try {
      localStorage.setItem('gpdms_real_material_issued_bills', JSON.stringify(updatedMap));
    } catch (_) {}

    // 3. Immediately update materials in memory
    const changedMaterials = [];
    const updatedMaterials = materials.map(m => {
      const matched = itemsToDeduct.find(i => String(i.materialId) === String(m.id));
      if (matched) {
        const newStock = Math.max(0, Math.round(((m.stock || 0) - matched.totalRequired) * 100) / 100);
        const updated = { ...m, stock: newStock };
        changedMaterials.push(updated);
        if (typeof onUpdateMaterial === 'function') {
          onUpdateMaterial(updated);
        }
        return updated;
      }
      return m;
    });

    // Notify parent ONLY with changed items (not the entire 2000-material list!)
    if (typeof syncMaterialsToDb === 'function' && changedMaterials.length > 0) {
      syncMaterialsToDb(changedMaterials);
    }

    showToast(`⚡ Bill #${bill.billNo} Issued! Stock deducted.`, 'success');

    // 4. Background non-blocking network sync (fire-and-forget)
    (async () => {
      try {
        // Send PUT to MySQL for only the 1-2 changed items
        for (const cm of changedMaterials) {
          fetch(`${getBackendUrl()}/api/materials/${cm.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cm)
          }).catch(() => {});
        }

        // Post to issue_logs
        fetch(`${getBackendUrl()}/api/issue-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `REAL-MI-${bill.billNo}-${Math.floor(100 + Math.random() * 900)}`,
            lotId: bill.lotNo || 'Direct Floor',
            isReissue: false,
            isReturn: false,
            category: `ACTUAL ${bill.typeLabel.toUpperCase()}`,
            volume: bill.quantity || bill.elasticRolls || 1,
            personName: currentUser?.name || 'Store Incharge',
            receiverName: receiverName || 'Cutting Floor',
            receiverDept: receiverDept || 'CUTTING',
            date: issueTimestamp,
            materials: itemsToDeduct.map(i => ({
              name: i.materialName,
              materialId: i.materialId,
              bomItemName: i.bomItemName,
              qty: i.totalRequired,
              unit: i.unit,
              billNo: bill.billNo,
              location: i.location,
              remainingStock: i.stockAfter
            }))
          })
        }).catch(() => {});

        // Save status in DB payload
        const updatedPayload = {
          ...(bill.payload || {}),
          realMaterialIssued: true,
          ...newIssuedRecord
        };
        const endpoint = bill.sourceTable === 'elastic_issue' ? '/api/elastic-issues' : '/api/bone-issues';
        fetch(`${getBackendUrl()}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slipNo: bill.billNo,
            lotNo: bill.lotNo,
            rolls: bill.elasticRolls || bill.boneRolls || 1,
            issuerName: bill.issuerName,
            receiverName: receiverName,
            supervisorName: bill.supervisorName,
            issueDate: bill.date,
            style: bill.style,
            brand: bill.brand,
            garmentType: bill.garmentType,
            fabric: bill.fabric,
            quantity: bill.quantity,
            shade: bill.shade,
            size: bill.size,
            elasticWidth: bill.elasticWidth,
            remarks: `${bill.remarks || ''} [ACTUAL_STOCK_DEDUCTED: ${issueTimestamp}]`,
            payload: JSON.stringify(updatedPayload)
          })
        }).catch(() => {});
      } catch (err) {
        console.warn('Background sync error (non-fatal):', err);
      }
    })();
  };

  // ── 1-Click Fast Issue (Opens Verification Modal with Photo, Category & Chooser) ──
  const handleQuick1ClickIssue = (bill) => {
    // Open verification modal so user can visually verify photo & category and choose/switch material
    handleOpenIssueModal(bill);
  };


  // ── Modal Submit Handler ──────────────────────────────────────────────────
  const handleConfirmIssueMaterial = () => {
    if (!issueModalBill) return;
    const itemsToDeduct = [];
    const bill = issueModalBill;

    if (bill.billType === 'elastic' || bill.billType === 'both') {
      const mat = materials.find(m => String(m.id) === String(issueForm.elasticMaterialId)) || getBestElasticMaterial(bill.elasticWidth);
      const qty = parseFloat(issueForm.customElasticQty) || bill.elasticRolls || 1;
      if (mat && qty > 0) {
        itemsToDeduct.push({
          materialId: mat.id,
          materialName: mat.name,
          bomItemName: 'Elastic Waistband',
          totalRequired: qty,
          unit: mat.unit || 'Roll',
          location: mat.location || 'Main Store',
          stockBefore: mat.stock || 0,
          stockAfter: Math.max(0, Math.round(((mat.stock || 0) - qty) * 100) / 100)
        });
      }
    }

    if (bill.billType === 'tape' || bill.billType === 'both') {
      const mat = materials.find(m => String(m.id) === String(issueForm.tapeMaterialId)) || getBestTapeMaterial(bill.tapeWidth);
      const qty = parseFloat(issueForm.customTapeQty) || bill.totalTapeMtr || 1;
      if (mat && qty > 0) {
        itemsToDeduct.push({
          materialId: mat.id,
          materialName: mat.name,
          bomItemName: 'Tape / Lace',
          totalRequired: qty,
          unit: mat.unit || 'Mtr',
          location: mat.location || 'Main Store',
          stockBefore: mat.stock || 0,
          stockAfter: Math.max(0, Math.round(((mat.stock || 0) - qty) * 100) / 100)
        });
      }
    }

    if (bill.billType === 'bone') {
      const mat = materials.find(m => String(m.id) === String(issueForm.boneMaterialId)) || getBestBoneMaterial();
      const qty = parseFloat(issueForm.customBoneQty) || bill.boneRolls || parseFloat(bill.boneWeightKg) || 1;
      if (mat && qty > 0) {
        itemsToDeduct.push({
          materialId: mat.id,
          materialName: mat.name,
          bomItemName: 'Bone / Piping',
          totalRequired: qty,
          unit: mat.unit || 'Roll',
          location: mat.location || 'Main Store',
          stockBefore: mat.stock || 0,
          stockAfter: Math.max(0, Math.round(((mat.stock || 0) - qty) * 100) / 100)
        });
      }
    }

    if (itemsToDeduct.length === 0) {
      showToast('Please select at least one material to deduct from inventory.', 'error');
      return;
    }

    executeRealMaterialIssue(bill, itemsToDeduct, issueForm.receiverName || bill.receiverName, issueForm.receiverDept);
  };

  // ── Quick Select Bill by Dropdown ─────────────────────────────────────────
  const handleSelectQuickBill = (bNo) => {
    setSelectedQuickBillNo(bNo);
    const target = normalizedParchis.find(p => p.billNo === bNo);
    if (target) {
      handleOpenIssueModal(target);
    }
  };

  // ── Print Bill / Parchi (Professional Black & White Print Layout) ─────────
  const handlePrintParchi = (bill) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const margin = 28;
      const contentW = pw - (margin * 2);
      let y = margin;

      // ── OUTER DOCUMENT BORDER (Crisp Corporate Border) ────────────────────
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1);
      doc.rect(margin, margin, contentW, ph - (margin * 2));

      // ── HEADER BOX (Crisp Monochrome, NO dark solid block!) ──────────────
      const headerH = 70;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.75);
      doc.line(margin, y + headerH, margin + contentW, y + headerH);

      // Vertical divider between Company info and Challan metadata
      const headerSplitX = margin + contentW - 225;
      doc.line(headerSplitX, y, headerSplitX, y + headerH);

      // Left Section: Company & Challan Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(0, 0, 0);
      doc.text('MOHIT HOSIERY', margin + 12, y + 22);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);
      doc.text('CENTRAL STORE & ACCESSORIES ISSUE DEPARTMENT', margin + 12, y + 36);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(0, 0, 0);
      doc.text('MATERIAL ISSUE CHALLAN / PARCHI', margin + 12, y + 52);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(70, 70, 70);
      const isBone = bill.billType === 'bone' || String(bill.billNo || '').toLowerCase().includes('bone');
      const isTape = bill.billType === 'tape' || String(bill.billNo || '').toLowerCase().includes('tape');
      const isOther = bill.billType === 'other' || String(bill.billNo || '').toLowerCase().includes('other');
      const isBoth = bill.billType === 'both';

      const categoryHeader = isBone
        ? 'BONE ISSUE'
        : isOther
          ? 'OTHER ACCESSORIES ISSUE'
          : isTape
            ? 'TAPE ISSUE'
            : isBoth
              ? 'ELASTIC & TAPE ISSUE'
              : (bill.typeLabel || 'ELASTIC ISSUE').toUpperCase();
      doc.text(`ISSUE CATEGORY: ${categoryHeader}`, margin + 12, y + 63);

      // Right Section: Challan Number & Metadata (Cleanly spaced, NO truncation, NO overflow)
      const colLabelX = headerSplitX + 8;
      const colValX = headerSplitX + 56;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('BILL NO:', colLabelX, y + 18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(String(bill.billNo || '—'), colValX, y + 18);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('DATE:', colLabelX, y + 32);
      doc.setFont('helvetica', 'normal');
      doc.text(String(bill.date || '—'), colValX, y + 32);

      doc.setFont('helvetica', 'bold');
      doc.text('LOT / MODE:', colLabelX, y + 46);
      doc.setFont('helvetica', 'normal');
      doc.text(bill.isWithoutLot ? (bill.lotNo && bill.lotNo !== 'Direct Floor' && !String(bill.lotNo).toLowerCase().includes('direct') ? `LOT #${bill.lotNo} (Direct Floor)` : 'Direct Floor (W/O PO)') : `LOT #${bill.lotNo}`, colValX, y + 46);

      doc.setFont('helvetica', 'bold');
      doc.text('STATUS:', colLabelX, y + 60);
      const isIssued = bill.issueStatus?.isIssued || String(bill.billNo || '').toUpperCase().startsWith('REAL-MI-');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(isIssued ? '[ REAL STOCK DEDUCTED ]' : '[ PENDING FLOOR ISSUE ]', colValX, y + 60);

      y += headerH;

      // ── STORE STATUS VERIFICATION STRIP (Guaranteed NO overflow) ──────────
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, contentW, 20, 'F');
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, y + 20, margin + contentW, y + 20);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      const statusText = isIssued
        ? `STORE STATUS: REAL MATERIAL ISSUED & STOCK DEDUCTED   |   REF: ${bill.issueStatus?.issuedAt || bill.date}   |   BY: ${bill.issueStatus?.issuedBy || bill.issuerName}`
        : `STORE STATUS: PENDING STORE INVENTORY DEDUCTION (CUTTING FLOOR REQUISITION SLIP)`;
      doc.text(statusText, margin + 10, y + 13);

      y += 20;

      // ── SECTION 1: PRODUCTION & LOT SPECIFICATIONS ───────────────────────
      const cuttingQtyDisplay = (() => {
        const qty = bill.quantity || bill.payload?.quantity || bill.payload?.issuePcs || bill.payload?.cuttingQty || 0;
        if (isBone) {
          const r = bill.boneRolls || bill.payload?.boneRolls || bill.payload?.rolls || 1;
          const w = bill.boneWeightKg || bill.payload?.boneWeightKg || bill.payload?.weight || (parseFloat(r) * 2.5).toFixed(2);
          if (qty > 0) {
            return `${qty} Pcs • ${r} Roll(s) (${w} Kg)`;
          }
          return `${r} Roll(s) (${w} Kg)`;
        }
        if (isTape) {
          const r = bill.tapeRolls || bill.payload?.tapeRolls || bill.payload?.rolls || (qty > 0 ? Math.ceil(qty / 45) : 1);
          const m = bill.totalTapeMtr || bill.payload?.totalTapeMtr || 0;
          if (qty > 0) {
            return `${qty} Pcs • ${r} Roll(s)${m > 0 ? ` (${m} Mtrs)` : ''}`;
          }
          return `${r} Roll(s)${m > 0 ? ` (${m} Mtrs)` : ''}`;
        }
        if (isOther) {
          const r = bill.otherRollCount || bill.payload?.otherRollCount || bill.payload?.rolls || 1;
          const u = bill.otherUnit || bill.payload?.otherUnit || 'Roll';
          if (qty > 0) {
            return `${qty} Pcs • ${r} ${u}(s)`;
          }
          return `${r} ${u}(s)`;
        }
        const r = bill.elasticRolls || bill.payload?.elasticRolls || bill.payload?.rolls || 1;
        const m = bill.totalElasticMtr || bill.payload?.totalElasticMtr || 0;
        if (qty > 0) {
          return `${qty} Pcs • ${r} Roll(s)${m > 0 ? ` (${m} Mtrs)` : ''}`;
        }
        return `${r} Roll(s)${m > 0 ? ` (${m} Mtrs)` : ''}`;
      })();

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        tableWidth: contentW,
        head: [[
          { content: '1. PRODUCTION & LOT SPECIFICATIONS', colSpan: 4, styles: { halign: 'left', fontStyle: 'bold', fillColor: [235, 235, 235], textColor: [0, 0, 0], fontSize: 8.5 } }
        ]],
        body: [
          [
            { content: 'Lot Number:', styles: { fontStyle: 'bold', cellWidth: 90 } },
            { content: bill.isWithoutLot ? (bill.lotNo && bill.lotNo !== 'Direct Floor' && !String(bill.lotNo).toLowerCase().includes('direct') ? `LOT #${bill.lotNo} (Direct Floor Issue)` : 'Direct Floor Issue (W/O PO)') : `LOT #${bill.lotNo}`, styles: { cellWidth: 175 } },
            { content: bill.isWithoutLot ? 'Requisition / Cutting Qty:' : 'Cutting Quantity:', styles: { fontStyle: 'bold', cellWidth: 105 } },
            { content: cuttingQtyDisplay, styles: { fontStyle: 'bold', cellWidth: 169 } }
          ],
          [
            { content: 'Style / Design:', styles: { fontStyle: 'bold' } },
            { content: String(bill.style || 'Lower / Tracksuit') },
            { content: 'Brand / Buyer:', styles: { fontStyle: 'bold' } },
            { content: String(bill.brand || 'Mohit Hosiery') }
          ],
          [
            { content: 'Garment Type:', styles: { fontStyle: 'bold' } },
            { content: String(bill.garmentType || 'Lower') },
            { content: 'Fabric / Shade:', styles: { fontStyle: 'bold' } },
            { content: `${bill.fabric || '—'} / ${bill.shade || '—'}` }
          ],
          [
            { content: 'Issue Mode:', styles: { fontStyle: 'bold' } },
            { content: bill.isWithoutLot ? 'Direct Cutting Floor Requisition' : 'Production Work Order' },
            { content: 'Size / Measurement:', styles: { fontStyle: 'bold' } },
            { content: String(bill.size || 'Standard') }
          ]
        ],
        theme: 'grid',
        styles: {
          fontSize: 8,
          textColor: [0, 0, 0],
          cellPadding: 3.5,
          lineColor: [180, 180, 180],
          lineWidth: 0.5
        }
      });

      y = doc.lastAutoTable.finalY;

      // ── SECTION 2: MATERIAL BILL PARTICULARS & ACTUAL STORE DEDUCTION ────
      const matRows = [];
      let srNum = 1;
      const deductedItems = (bill.issueStatus?.deductedItems && bill.issueStatus.deductedItems.length > 0)
        ? bill.issueStatus.deductedItems
        : (bill.payload?.deductedItems || []);

      // 1. Elastic
      if ((bill.billType === 'elastic' || isBoth) && !isBone && !isTape) {
        const deducted = deductedItems.find(i => (i.bomItemName || '').toLowerCase().includes('elastic') || (i.materialName || '').toLowerCase().includes('elastic'));
        const matchedMat = getBestElasticMaterial(bill.elasticWidth);
        const eWidth = bill.elasticWidth || bill.payload?.elasticWidth || '1 Inch (Standard)';
        const eCut = bill.elasticSizeInput || bill.payload?.elasticSizeInput || 0;
        const eUnit = bill.unitType || bill.payload?.unitType || 'inch';
        let eRolls = bill.elasticRolls || bill.payload?.elasticRolls || bill.payload?.rolls || 1;
        let eMtrs = bill.totalElasticMtr || bill.payload?.totalElasticMtr || 0;
        const ePcs = bill.quantity || bill.payload?.issuePcs || bill.payload?.quantity || 0;
        let ePerPc = bill.elasticPerPcMtr || bill.payload?.elasticPerPcMtr || 0;

        if (deducted) {
          if (String(deducted.unit).toLowerCase().includes('roll')) {
            eRolls = deducted.totalRequired || eRolls;
          } else if (String(deducted.unit).toLowerCase().includes('mtr')) {
            eMtrs = deducted.totalRequired || eMtrs;
          }
        }
        if (!eMtrs && ePcs > 0 && ePerPc > 0) {
          eMtrs = (ePcs * ePerPc).toFixed(2);
        }
        if (!eRolls && eMtrs > 0) {
          const div = String(eWidth).includes('1.5') || String(eWidth).includes('2') ? 23 : 25;
          eRolls = Math.ceil(eMtrs / div);
        }

        const realStockText = deducted
          ? `${deducted.materialName} (ID: ${deducted.materialId || ''})\n[Deducted: ${deducted.totalRequired} ${deducted.unit}]`
          : (matchedMat ? `${matchedMat.name} (ID: ${matchedMat.id})` : 'Elastic Store Stock');
        const locText = deducted?.location || matchedMat?.location || 'RACK 212';

        matRows.push([
          `0${srNum++}`,
          'Elastic Waistband',
          `Width: ${eWidth}\nCut: ${eCut} ${eUnit}${ePcs > 0 ? `\nTarget Qty: ${ePcs} Pcs` : ''}`,
          ePerPc > 0 ? `${ePerPc} m/pc` : `${eRolls} Roll(s)`,
          `${eRolls} Roll(s)\n(${eMtrs > 0 ? `${eMtrs} Meters` : ''}${ePcs > 0 ? ` • ${ePcs} Pcs` : ''})`,
          realStockText,
          locText
        ]);
      }

      // 2. Tape
      if ((bill.billType === 'tape' || isBoth || isTape) && !isBone) {
        const deducted = deductedItems.find(i => (i.bomItemName || '').toLowerCase().includes('tape') || (i.materialName || '').toLowerCase().includes('tape'));
        const matchedMat = getBestTapeMaterial(bill.tapeWidth);
        const tWidth = bill.tapeWidth || bill.payload?.tapeWidth || '0.5 Inch (Standard)';
        const tCut = bill.tapeSizeInput || bill.payload?.tapeSizeInput || '—';
        let tRolls = bill.tapeRolls || bill.payload?.tapeRolls || bill.payload?.rolls || 1;
        let tMtrs = bill.totalTapeMtr || bill.payload?.totalTapeMtr || 0;
        const tPcs = bill.quantity || bill.payload?.issuePcs || bill.payload?.quantity || 0;
        let tPerPc = bill.tapePerPcMtr || bill.payload?.tapePerPcMtr || 0;

        if (deducted) {
          if (String(deducted.unit).toLowerCase().includes('roll')) {
            tRolls = deducted.totalRequired || tRolls;
          } else if (String(deducted.unit).toLowerCase().includes('mtr')) {
            tMtrs = deducted.totalRequired || tMtrs;
          }
        }
        if (!tMtrs && tPcs > 0 && tPerPc > 0) {
          tMtrs = (tPcs * tPerPc).toFixed(2);
        }
        if (!tRolls && tPcs > 0) {
          tRolls = Math.ceil(tPcs / 45);
        }

        const realStockText = deducted
          ? `${deducted.materialName} (ID: ${deducted.materialId || ''})\n[Deducted: ${deducted.totalRequired} ${deducted.unit}]`
          : (matchedMat ? `${matchedMat.name} (ID: ${matchedMat.id})` : 'Tape Store Stock');
        const locText = deducted?.location || matchedMat?.location || 'Main Store';

        matRows.push([
          `0${srNum++}`,
          'Tape / Drawcord / Lace',
          `Width: ${tWidth}\nCut: ${tCut} CM${tPcs > 0 ? `\nTarget Qty: ${tPcs} Pcs` : ''}`,
          tPerPc > 0 ? `${tPerPc} m/pc` : '1 Roll / 45 Pcs',
          `${tRolls} Roll(s)\n(${tMtrs > 0 ? `${tMtrs} Meters` : ''}${tPcs > 0 ? ` • ${tPcs} Pcs` : ''})`,
          realStockText,
          locText
        ]);
      }

      // 3. Bone
      if (isBone) {
        const deducted = deductedItems.find(i => (i.bomItemName || '').toLowerCase().includes('bone') || (i.materialName || '').toLowerCase().includes('bone')) || deductedItems[0];
        const matchedMat = getBestBoneMaterial();
        const bWidth = bill.boneWidth || bill.payload?.boneWidth || bill.payload?.width || '1.5 Inch (Standard)';
        let bRolls = bill.boneRolls || bill.payload?.boneRolls || bill.payload?.rolls || bill.rolls;
        let bWeight = bill.boneWeightKg || bill.payload?.boneWeightKg || bill.payload?.weight || bill.weight;

        if (deducted) {
          if (String(deducted.unit).toLowerCase().includes('roll')) {
            bRolls = deducted.totalRequired || bRolls || 1;
            if (!bWeight || bWeight === '2.50' || bWeight === 'undefined') {
              bWeight = (parseFloat(bRolls) * 2.5).toFixed(2);
            }
          } else if (String(deducted.unit).toLowerCase().includes('kg')) {
            bWeight = deducted.totalRequired || bWeight || '2.50';
            if (!bRolls || bRolls === 'undefined') {
              bRolls = Math.max(1, Math.round(parseFloat(bWeight) / 2.5));
            }
          }
        }
        if (!bRolls || isNaN(bRolls) || bRolls === 'undefined') bRolls = 1;
        if (!bWeight || bWeight === 'undefined' || isNaN(parseFloat(bWeight))) bWeight = (parseFloat(bRolls) * 2.5).toFixed(2);

        const bPcs = bill.quantity || bill.payload?.issuePcs || bill.payload?.quantity || bill.payload?.cuttingQty || 0;

        const realStockText = deducted
          ? `${deducted.materialName} (ID: ${deducted.materialId || 'ST00346'})\n[Deducted: ${deducted.totalRequired} ${deducted.unit}]`
          : (bill.boneMaterialName ? `${bill.boneMaterialName} (ID: ${bill.selectedBoneMaterialId || 'ST00346'})` : (matchedMat ? `${matchedMat.name} (ID: ${matchedMat.id})` : 'Bone Chinese (Beige) (ID: ST00346)'));
        const locText = deducted?.location || bill.location || matchedMat?.location || 'Main Store - RACK 208';

        const specText = `Width: ${bWidth}\nWeight: ${bWeight} Kg\nRolls: ${bRolls} Roll(s)`;
        const perPcText = bPcs > 0 ? `${(parseFloat(bWeight) * 1000 / bPcs).toFixed(1)} g/pc` : `${(parseFloat(bWeight) / bRolls).toFixed(2)} Kg/roll`;
        const totalReqText = `${bRolls} Roll(s)\n(${bWeight} Kg${bPcs > 0 ? ` • ${bPcs} Pcs` : ''})`;

        matRows.push([
          `0${srNum++}`,
          'Bone / Piping Pocketing',
          specText,
          perPcText,
          totalReqText,
          realStockText,
          locText
        ]);
      }

      // 4. Other Accessories or Fallback from deductedItems / bill
      if (isOther || matRows.length === 0) {
        if (deductedItems.length > 0) {
          deductedItems.forEach((d) => {
            const dName = d.bomItemName || d.materialName || 'Accessory Item';
            const dQty = d.totalRequired || d.qty || 1;
            const dUnit = d.unit || 'Roll';
            const dLoc = d.location || 'Main Store';
            const pcs = bill.quantity || bill.payload?.issuePcs || 0;

            matRows.push([
              `0${srNum++}`,
              dName,
              `Deducted Item\nUnit: ${dUnit}${pcs > 0 ? `\nTarget Qty: ${pcs} Pcs` : ''}`,
              pcs > 0 ? `${(dQty / pcs).toFixed(3)} ${dUnit}/pc` : 'Direct Issue',
              `${dQty} ${dUnit}${pcs > 0 ? `\n(For ${pcs} Pcs)` : ''}`,
              `${d.materialName || dName} (ID: ${d.materialId || '—'})`,
              dLoc
            ]);
          });
        } else {
          const oName = bill.otherMaterialName || bill.payload?.otherMaterialName || 'Other Accessory';
          const oUnit = bill.otherUnit || bill.payload?.otherUnit || 'Roll';
          const oQty = bill.otherRollCount || bill.payload?.otherRollCount || bill.quantity || 1;
          const pcs = bill.quantity || bill.payload?.issuePcs || 0;

          matRows.push([
            `0${srNum++}`,
            oName,
            `Category: Other Accessory\nUnit: ${oUnit}${pcs > 0 ? `\nTarget Qty: ${pcs} Pcs` : ''}`,
            'Direct Issue',
            `${oQty} ${oUnit}${pcs > 0 ? `\n(For ${pcs} Pcs)` : ''}`,
            oName,
            'Main Store'
          ]);
        }
      }

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        tableWidth: contentW,
        head: [
          [
            { content: '2. MATERIAL BILL CONSUMPTION & REAL STORE INVENTORY DEDUCTION', colSpan: 7, styles: { halign: 'left', fontStyle: 'bold', fillColor: [235, 235, 235], textColor: [0, 0, 0], fontSize: 8.5 } }
          ],
          ['SR.', 'MATERIAL CATEGORY', 'SPEC / CUT INPUT', 'PER PC CONSUMPTION', 'TOTAL REQUIRED', 'REAL STORE ITEM DEDUCTED', 'STORE LOCATION']
        ],
        body: matRows,
        theme: 'grid',
        headStyles: {
          fillColor: [245, 245, 245],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'center',
          lineColor: [160, 160, 160],
          lineWidth: 0.5
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [0, 0, 0],
          cellPadding: 4,
          lineColor: [180, 180, 180],
          lineWidth: 0.5
        },
        columnStyles: {
          0: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 85, fontStyle: 'bold' },
          2: { cellWidth: 95 },
          3: { cellWidth: 70, halign: 'center' },
          4: { cellWidth: 75, halign: 'center', fontStyle: 'bold' },
          5: { cellWidth: 120 },
          6: { cellWidth: 70, halign: 'center' }
        }
      });

      y = doc.lastAutoTable.finalY;

      // ── SECTION 3: REQUISITION & DISPATCH PARTICULARS ──────────────────────
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        tableWidth: contentW,
        head: [[
          { content: '3. REQUISITION & DISPATCH PARTICULARS', colSpan: 4, styles: { halign: 'left', fontStyle: 'bold', fillColor: [235, 235, 235], textColor: [0, 0, 0], fontSize: 8.5 } }
        ]],
        body: [
          [
            { content: 'Issued By (Store):', styles: { fontStyle: 'bold', cellWidth: 100 } },
            { content: String(bill.issuerName || 'Store Incharge'), styles: { cellWidth: 165 } },
            { content: 'Received By (Cutting):', styles: { fontStyle: 'bold', cellWidth: 105 } },
            { content: `${bill.receiverName && bill.receiverName !== '—' ? bill.receiverName : 'Cutting Master'} (CUTTING)`, styles: { cellWidth: 169 } }
          ],
          [
            { content: 'Floor Supervisor:', styles: { fontStyle: 'bold' } },
            { content: String(bill.supervisorName || 'ROHIT / MONU') },
            { content: 'Department:', styles: { fontStyle: 'bold' } },
            { content: 'CUTTING / PRODUCTION FLOOR' }
          ],
          [
            { content: 'Bill Created Date:', styles: { fontStyle: 'bold' } },
            { content: String(bill.date || '—') },
            { content: 'Actual Issue Timestamp:', styles: { fontStyle: 'bold' } },
            { content: String(bill.issueStatus?.issuedAt || (isIssued ? bill.date : 'Pending Actual Issue')) }
          ],
          [
            { content: 'Remarks / Notes:', styles: { fontStyle: 'bold' } },
            { content: String(bill.remarks || 'Official floor material requisition for garment manufacturing.'), colSpan: 3 }
          ]
        ],
        theme: 'grid',
        styles: {
          fontSize: 8,
          textColor: [0, 0, 0],
          cellPadding: 3.5,
          lineColor: [180, 180, 180],
          lineWidth: 0.5
        }
      });

      y = doc.lastAutoTable.finalY;

      // ── SECTION 4: AUTHORIZATION & SIGNATURES ──────────────────────────────
      doc.setFillColor(235, 235, 235);
      doc.rect(margin, y, contentW, 16, 'F');
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, y + 16, margin + contentW, y + 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text('4. AUTHORIZATION, ACKNOWLEDGEMENT & OFFICIAL SIGNATURES', margin + 8, y + 11);

      y += 16;

      const sigBoxW = contentW / 3;
      const sigBoxH = 68;

      // 3 side-by-side signature boxes
      for (let i = 0; i < 3; i++) {
        const bx = margin + (i * sigBoxW);
        doc.rect(bx, y, sigBoxW, sigBoxH);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(50, 50, 50);

        if (i === 0) {
          doc.text('STORE INCHARGE', bx + 10, y + 13);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text(`Authorized: ${bill.issuerName || 'Store Incharge'}`, bx + 10, y + 23);

          doc.setLineDashPattern([2, 2], 0);
          doc.line(bx + 10, y + 50, bx + sigBoxW - 10, y + 50);
          doc.setLineDashPattern([], 0);

          doc.setFont('helvetica', 'bold');
          doc.text('SIGNATURE / DATE', bx + 10, y + 60);
        } else if (i === 1) {
          doc.text('RECEIVER (CUTTING FLOOR)', bx + 10, y + 13);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text(`Name: ${bill.receiverName && bill.receiverName !== '—' ? bill.receiverName : 'Cutting Floor'}`, bx + 10, y + 23);

          doc.setLineDashPattern([2, 2], 0);
          doc.line(bx + 10, y + 50, bx + sigBoxW - 10, y + 50);
          doc.setLineDashPattern([], 0);

          doc.setFont('helvetica', 'bold');
          doc.text('RECEIVER SIGNATURE / DATE', bx + 10, y + 60);
        } else {
          doc.text('SUPERVISOR / APPROVAL', bx + 10, y + 13);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text(`Approved: ${bill.supervisorName || 'Supervisor'}`, bx + 10, y + 23);

          doc.setLineDashPattern([2, 2], 0);
          doc.line(bx + 10, y + 50, bx + sigBoxW - 10, y + 50);
          doc.setLineDashPattern([], 0);

          doc.setFont('helvetica', 'bold');
          doc.text('AUTHORIZING SEAL / SIGN', bx + 10, y + 60);
        }
      }

      y += sigBoxH;

      // ── FOOTER NOTICE (BOTTOM OF PAGE) ────────────────────────────────────
      const footerY = ph - margin - 18;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY, margin + contentW, footerY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text(
        'This is a computer-generated official store issue voucher. Materials issued are directly debited to production floor consumption.',
        margin + 8,
        footerY + 11
      );

      const printTimeStr = new Date().toLocaleString('en-GB');
      doc.setFont('helvetica', 'bold');
      doc.text(`Printed: ${printTimeStr}  •  Page 1 of 1`, pw - margin - 8, footerY + 11, { align: 'right' });

      // Save PDF and open direct print window
      doc.save(`PARCHI_BILL_${bill.billNo}.pdf`);
      try {
        const blobUrl = doc.output('bloburl');
        window.open(blobUrl, '_blank');
      } catch (_) {}

      showToast(`Parchi Bill #${bill.billNo} generated & downloaded!`, 'success');
    } catch (e) {
      console.error('Error generating PDF:', e);
      showToast('Failed to generate PDF.', 'error');
    }
  };

  // ── Quick Create New Bill No Parchi ───────────────────────────────────────
  const handleCreateQuickParchi = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const pcs = parseInt(genPcs || 0, 10);

      if (genType === 'bone') {
        const slipNo = `BONE-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const payloadData = {
          slipNo,
          lotNo: genIsWithoutLot ? 'Direct Floor' : (genLotNo || 'Direct Floor'),
          issuePcs: pcs,
          boneWeightKg: genBoneWeightKg,
          weight: genBoneWeightKg,
          rolls: parseInt(genBoneRolls, 10) || 1,
          supervisorName: genSupervisor,
          boneWidth: genBoneWidth,
          issuerName: currentUser?.name || 'Store Incharge',
          receiverName: genReceiver || 'Cutting Master',
          style: genStyle,
          remarks: genRemarks
        };

        const res = await fetch(`${getBackendUrl()}/api/bone-issues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slipNo,
            lotNo: genIsWithoutLot ? 'Direct Floor' : (genLotNo || 'Direct Floor'),
            rolls: parseInt(genBoneRolls, 10) || 1,
            issuerName: currentUser?.name || 'Store Incharge',
            receiverName: genReceiver || 'Cutting Master',
            issueDate: dateStr,
            style: genStyle,
            brand: 'Mohit Hosiery',
            garmentType: 'Lower',
            fabric: 'Cotton',
            quantity: pcs,
            shade: 'Black',
            size: 'Standard',
            remarks: genRemarks,
            payload: JSON.stringify(payloadData)
          })
        });

        if (res.ok) {
          showToast(`Bone Bill #${slipNo} generated successfully!`, 'success');
          setActiveTab('all_parchis');
          await fetchAllParchis();
          if (autoOpenIssueAfterGen) {
            handleOpenIssueModal({
              billNo: slipNo,
              lotNo: genIsWithoutLot ? 'Direct Floor' : (genLotNo || 'Direct Floor'),
              billType: 'bone',
              typeLabel: 'Bone Issue',
              quantity: pcs,
              boneRolls: parseInt(genBoneRolls, 10) || 1,
              boneWeightKg: genBoneWeightKg,
              receiverName: genReceiver || 'ROHIT',
              sourceTable: 'bone_issue',
              payload: payloadData
            });
          }
        }
      } else {
        let prefix = 'ELS';
        if (genType === 'tape') prefix = 'TAPE';
        if (genType === 'both') prefix = 'ELSTAPE';

        const slipNo = `${prefix}-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const eSize = parseFloat(genElasticSize) || 0;
        const eMtrPerPc = genElasticUnit === 'cm' ? parseFloat((eSize / 100).toFixed(4)) : parseFloat((eSize * 0.0254).toFixed(4));
        const totalElasticMtr = parseFloat((pcs * eMtrPerPc).toFixed(4));

        const tSize = parseFloat(genTapeSize) || 0;
        const tMtrPerPc = genTapeUnit === 'cm' ? parseFloat((tSize / 100).toFixed(4)) : parseFloat((tSize * 0.0254).toFixed(4));
        const totalTapeMtr = parseFloat((pcs * tMtrPerPc).toFixed(4));

        const rolls = totalElasticMtr > 0 ? Math.ceil(totalElasticMtr / 25) : 1;

        const payloadData = {
          slipNo,
          lotNo: genIsWithoutLot ? 'Direct Floor' : (genLotNo || 'Direct Floor'),
          style: genStyle,
          brand: 'Mohit Hosiery',
          garmentType: 'Lower',
          quantity: pcs,
          elasticWidth: genElasticWidth,
          tapeWidth: genTapeWidth,
          unitType: genElasticUnit,
          elasticSizeInput: eSize,
          elasticPerPcMtr: eMtrPerPc,
          totalElasticMtr,
          tapeSizeInput: tSize,
          tapePerPcMtr: tMtrPerPc,
          totalTapeMtr,
          supervisorName: genSupervisor,
          remarks: genRemarks
        };

        const res = await fetch(`${getBackendUrl()}/api/elastic-issues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slipNo,
            lotNo: genIsWithoutLot ? 'Direct Floor' : (genLotNo || 'Direct Floor'),
            rolls,
            issuerName: currentUser?.name || 'Store Incharge',
            receiverName: genReceiver || 'Cutting Master',
            supervisorName: genSupervisor,
            issueDate: dateStr,
            style: genStyle,
            brand: 'Mohit Hosiery',
            garmentType: 'Lower',
            fabric: 'Cotton',
            quantity: pcs,
            shade: 'Black',
            size: 'Free',
            elasticWidth: genElasticWidth,
            unitType: genElasticUnit,
            elasticSizeInput: eSize,
            elasticPerPcMtr: eMtrPerPc,
            totalElasticMtr,
            tapePerPcMtr: tMtrPerPc,
            totalTapeMtr,
            remarks: genRemarks,
            payload: JSON.stringify(payloadData)
          })
        });

        if (res.ok) {
          showToast(`Bill #${slipNo} generated successfully!`, 'success');
          setActiveTab('all_parchis');
          await fetchAllParchis();
          if (autoOpenIssueAfterGen) {
            handleOpenIssueModal({
              billNo: slipNo,
              lotNo: genIsWithoutLot ? 'Direct Floor' : (genLotNo || 'Direct Floor'),
              billType: genType,
              typeLabel: genType === 'tape' ? 'Tape Issue' : genType === 'both' ? 'Elastic & Tape' : 'Elastic Issue',
              quantity: pcs,
              elasticRolls: rolls,
              totalElasticMtr,
              totalTapeMtr,
              elasticWidth: genElasticWidth,
              tapeWidth: genTapeWidth,
              receiverName: genReceiver || 'ROHIT',
              sourceTable: 'elastic_issue',
              payload: payloadData
            });
          }
        }
      }
    } catch (err) {
      console.error('Error generating parchi:', err);
      showToast('Error generating bill.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // ── Delete Bill Parchi ───────────────────────────────────────────────────
  const handleDeleteParchi = async (bill) => {
    if (!window.confirm(`Are you sure you want to delete Bill #${bill.billNo}?`)) {
      return;
    }

    try {
      const endpoint = bill.sourceTable === 'elastic_issue'
        ? `${getBackendUrl()}/api/elastic-issues/${bill.rawId || bill.billNo}`
        : `${getBackendUrl()}/api/bone-issues/${bill.rawId || bill.billNo}`;

      const res = await fetch(endpoint, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Bill #${bill.billNo} removed.`, 'success');
        fetchAllParchis();
      } else {
        showToast('Failed to delete bill from server.', 'error');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Error deleting bill.', 'error');
    }
  };

  return (
    <div className="elastic-tape-issue-container" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: '#1e293b' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '12px 20px',
          borderRadius: '8px',
          backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          fontWeight: '600',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Main Header ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        padding: '24px 28px',
        borderRadius: '16px',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(67, 56, 202, 0.3)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{
              background: 'rgba(255, 255, 255, 0.15)',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              Real Store Inventory Issue
            </span>
            <span style={{
              background: '#10b981',
              color: '#ffffff',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700'
            }}>
              STOCK DEDUCTION LIVE
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>
            Elastic, Tape & Bone Real Material Issue
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#c7d2fe' }}>
            All Bill Numbers & Parchis • Select Bill No & Issue Actual Real Materials from Store Inventory
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={fetchAllParchis}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              padding: '10px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Refresh All Slips from Database"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'quick_generate' ? 'all_parchis' : 'quick_generate')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'quick_generate' ? '#ffffff' : '#6366f1',
              color: activeTab === 'quick_generate' ? '#312e81' : '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.2s'
            }}
          >
            {activeTab === 'quick_generate' ? (
              <>
                <Table size={15} />
                <span>View All Parchis ({normalizedParchis.length})</span>
              </>
            ) : (
              <>
                <Plus size={15} />
                <span>Generate New Bill No</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── TOP SECTION: DIRECT ISSUE BY BILL NO ─────────────────────────── */}
      <div style={{
        background: '#ffffff',
        padding: '18px 24px',
        borderRadius: '16px',
        border: '2px solid #6366f1',
        marginBottom: '20px',
        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.08)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 350px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            flexShrink: 0
          }}>
            <Zap size={22} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>
              ⚡ Issue Actual Material by Bill No
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Select any generated Bill No to instantly load required specs and deduct real store inventory
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 500px', flexWrap: 'wrap' }}>
          <select
            value={selectedQuickBillNo}
            onChange={(e) => setSelectedQuickBillNo(e.target.value)}
            style={{
              flex: '1 1 280px',
              minWidth: '240px',
              padding: '11px 16px',
              borderRadius: '10px',
              border: '2px solid #cbd5e1',
              fontSize: '14px',
              fontWeight: '700',
              color: '#1e293b',
              background: '#f8fafc',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="">-- Choose or Search Bill No (Slip No) to Issue --</option>
            {normalizedParchis.map(p => (
              <option key={p.billNo} value={p.billNo}>
                {p.billNo} • {p.typeLabel} • {p.isWithoutLot ? 'Direct Floor' : `Lot #${p.lotNo}`} • [{p.issueStatus.isIssued ? '✓ Already Issued' : '⏳ PENDING REAL ISSUE'}]
              </option>
            ))}
          </select>

          {selectedQuickBillNo && (() => {
            const chosen = normalizedParchis.find(p => p.billNo === selectedQuickBillNo);
            const isAlreadyIssued = chosen?.issueStatus?.isIssued;
            return (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={() => chosen && handleOpenIssueModal(chosen)}
                  title={isAlreadyIssued ? 'View or Re-Issue Stock' : 'Choose Material & Issue Stock'}
                  style={{
                    background: isAlreadyIssued ? '#f1f5f9' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    color: isAlreadyIssued ? '#475569' : '#ffffff',
                    border: isAlreadyIssued ? '1px solid #cbd5e1' : 'none',
                    padding: '10px 18px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: isAlreadyIssued ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.35)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isAlreadyIssued ? <RefreshCw size={14} /> : <Layers size={15} />}
                  <span>{isAlreadyIssued ? 'Re-Issue' : 'Issue Material'}</span>
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── KPI & Statistics Cards ────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Total Parchis */}
        <div style={{
          background: '#ffffff',
          padding: '18px 20px',
          borderRadius: '14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Total Bills / Slips
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca' }}>
              <FileText size={17} />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b' }}>
              {stats.totalCount}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Elastic: {stats.elasticCount} • Tape: {stats.tapeCount} • Bone: {stats.boneCount}
            </div>
          </div>
        </div>

        {/* Card 2: Actual Stock Fulfilled */}
        <div style={{
          background: '#ffffff',
          padding: '18px 20px',
          borderRadius: '14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Real Material Issued
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              <CheckCheck size={17} />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#16a34a' }}>
              {stats.issuedCount} <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Bills</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Real inventory stock deducted
            </div>
          </div>
        </div>

        {/* Card 3: Pending Actual Issue */}
        <div style={{
          background: '#ffffff',
          padding: '18px 20px',
          borderRadius: '14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Pending Actual Issue
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
              <Clock size={17} />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#d97706' }}>
              {stats.pendingCount} <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Bills</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Awaiting stock deduction
            </div>
          </div>
        </div>

        {/* Card 4: Elastic Consumption */}
        <div style={{
          background: '#ffffff',
          padding: '18px 20px',
          borderRadius: '14px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Elastic Required
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
              <Sliders size={17} />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#7c3aed' }}>
              {stats.totalElasticMtr} <span style={{ fontSize: '14px', fontWeight: '600' }}>Mtr</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Across {stats.totalElasticRolls} rolls
            </div>
          </div>
        </div>
      </div>

      {/* ── CONDITIONAL VIEW: QUICK GENERATOR FORM ───────────────────────── */}
      {activeTab === 'quick_generate' && (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '28px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>
                Generate New Bill No & Parchi
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Creates a new Bill No for Elastic, Tape, or Bone, and immediately allows issuing real stock
              </p>
            </div>
            <button
              onClick={() => setActiveTab('all_parchis')}
              style={{
                background: '#f1f5f9',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                color: '#475569'
              }}
            >
              Cancel & Back to List
            </button>
          </div>

          <form onSubmit={handleCreateQuickParchi}>
            {/* Category / Type Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
                Parchi Issue Type:
              </label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  { id: 'elastic', label: 'Elastic Issue', color: '#6366f1' },
                  { id: 'tape', label: 'Tape / Lace Issue', color: '#0284c7' },
                  { id: 'bone', label: 'Bone / Piping Issue', color: '#d97706' },
                  { id: 'both', label: 'Elastic & Tape (Both)', color: '#8b5cf6' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGenType(item.id)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      border: genType === item.id ? `2px solid ${item.color}` : '1px solid #e2e8f0',
                      background: genType === item.id ? `${item.color}15` : '#ffffff',
                      color: genType === item.id ? item.color : '#475569',
                      transition: 'all 0.15s'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Production Lot & Pcs Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                  Production Lot No:
                </label>
                <input
                  type="text"
                  value={genLotNo}
                  onChange={(e) => setGenLotNo(e.target.value)}
                  disabled={genIsWithoutLot}
                  placeholder={genIsWithoutLot ? 'Direct Floor (Without Lot)' : 'e.g. 11025'}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    backgroundColor: genIsWithoutLot ? '#f8fafc' : '#ffffff'
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: '#64748b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={genIsWithoutLot}
                    onChange={(e) => setGenIsWithoutLot(e.target.checked)}
                  />
                  <span>Direct Floor Issue (Without Lot / W/O PO)</span>
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                  Cutting Quantity (Pcs): *
                </label>
                <input
                  type="number"
                  required
                  value={genPcs}
                  onChange={(e) => setGenPcs(e.target.value)}
                  placeholder="e.g. 200"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                  Style / Garment Name:
                </label>
                <input
                  type="text"
                  value={genStyle}
                  onChange={(e) => setGenStyle(e.target.value)}
                  placeholder="e.g. Lower / Tracksuit"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Elastic Specific Fields */}
            {(genType === 'elastic' || genType === 'both') && (
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '700', color: '#4338ca' }}>
                  Elastic Specifications:
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      Cut Size Input:
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={genElasticSize}
                      onChange={(e) => setGenElasticSize(e.target.value)}
                      placeholder="e.g. 50"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      Unit:
                    </label>
                    <select
                      value={genElasticUnit}
                      onChange={(e) => setGenElasticUnit(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="inch">Inch (* 0.0254 = mtr)</option>
                      <option value="cm">CM (/ 100 = mtr)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      Elastic Width:
                    </label>
                    <select
                      value={genElasticWidth}
                      onChange={(e) => setGenElasticWidth(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="1 Inch (Standard)">1 Inch (Standard)</option>
                      <option value="1.25 Inch">1.25 Inch</option>
                      <option value="1.5 Inch">1.5 Inch</option>
                      <option value="2 Inch">2 Inch</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Tape Specific Fields */}
            {(genType === 'tape' || genType === 'both') && (
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '700', color: '#0284c7' }}>
                  Tape / Lace Specifications:
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      Tape Cut Size:
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={genTapeSize}
                      onChange={(e) => setGenTapeSize(e.target.value)}
                      placeholder="e.g. 62"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      Unit:
                    </label>
                    <select
                      value={genTapeUnit}
                      onChange={(e) => setGenTapeUnit(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="cm">CM (/ 100 = mtr)</option>
                      <option value="inch">Inch (* 0.0254 = mtr)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      Tape Width:
                    </label>
                    <select
                      value={genTapeWidth}
                      onChange={(e) => setGenTapeWidth(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="0.5 Inch (Standard)">0.5 Inch (Standard)</option>
                      <option value="0.75 Inch">0.75 Inch</option>
                      <option value="1 Inch">1 Inch</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Bone Specific Fields */}
            {genType === 'bone' && (
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '700', color: '#d97706' }}>
                  Bone / Piping Specifications:
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      Bone Weight (Kg):
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={genBoneWeightKg}
                      onChange={(e) => setGenBoneWeightKg(e.target.value)}
                      placeholder="e.g. 2.50"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      Roll Count:
                    </label>
                    <input
                      type="number"
                      value={genBoneRolls}
                      onChange={(e) => setGenBoneRolls(e.target.value)}
                      placeholder="e.g. 1"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      Bone Width:
                    </label>
                    <select
                      value={genBoneWidth}
                      onChange={(e) => setGenBoneWidth(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="1.5 Inch (Standard)">1.5 Inch (Standard)</option>
                      <option value="1 Inch">1 Inch</option>
                      <option value="2 Inch">2 Inch</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Receiver & Supervisor */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                  Receiver Name (Cutting Floor):
                </label>
                <input
                  type="text"
                  value={genReceiver}
                  onChange={(e) => setGenReceiver(e.target.value)}
                  placeholder="e.g. ROHIT / MONU"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                  Supervisor:
                </label>
                <input
                  type="text"
                  value={genSupervisor}
                  onChange={(e) => setGenSupervisor(e.target.value)}
                  placeholder="e.g. ROHIT / MONU"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                  Remarks:
                </label>
                <input
                  type="text"
                  value={genRemarks}
                  onChange={(e) => setGenRemarks(e.target.value)}
                  placeholder="Optional remarks"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Checkbox: Open Issue Dialog Immediately */}
            <div style={{ marginBottom: '20px', background: '#e0e7ff', padding: '12px 16px', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: '#312e81', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoOpenIssueAfterGen}
                  onChange={(e) => setAutoOpenIssueAfterGen(e.target.checked)}
                />
                <span>⚡ Immediately open Real Store Material Issue dialog after generating this Bill No</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setActiveTab('all_parchis')}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={generating}
                style={{
                  background: 'linear-gradient(135deg, #4338ca, #6366f1)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {generating ? <RefreshCw size={15} className="animate-spin" /> : <Zap size={15} />}
                <span>{generating ? 'Creating Bill...' : 'Generate Bill No & Proceed'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TOOLBAR & FILTERS ────────────────────────────────────────────── */}
      <div style={{
        background: '#ffffff',
        padding: '16px 20px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '14px',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        {/* Left: Search Box */}
        <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Bill No, Lot No, Receiver, Style, Supervisor..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Middle: Type Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginRight: '4px' }}>
            Type:
          </span>
          {[
            { id: 'all', label: `All (${normalizedParchis.length})` },
            { id: 'elastic', label: `Elastic (${stats.elasticCount})` },
            { id: 'tape', label: `Tape (${stats.tapeCount})` },
            { id: 'bone', label: `Bone (${stats.boneCount})` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                border: typeFilter === f.id ? '1px solid #4338ca' : '1px solid #e2e8f0',
                background: typeFilter === f.id ? '#e0e7ff' : '#f8fafc',
                color: typeFilter === f.id ? '#4338ca' : '#475569',
                transition: 'all 0.15s'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Right: Status Filter & Sort */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              fontWeight: '700',
              color: statusFilter === 'pending' ? '#d97706' : statusFilter === 'issued' ? '#16a34a' : '#334155',
              background: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Status ({normalizedParchis.length})</option>
            <option value="pending">⏳ Pending Actual Issue ({stats.pendingCount})</option>
            <option value="issued">✓ Real Material Issued ({stats.issuedCount})</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              fontWeight: '600',
              color: '#334155',
              background: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="seq_asc">Sort: Sequence (Ascending)</option>
            <option value="seq_desc">Sort: Latest Series (Descending)</option>
            <option value="newest">Sort: Newest Date First</option>
            <option value="oldest">Sort: Oldest Date First</option>
            <option value="bill_no">Sort: Bill No</option>
            <option value="lot_no">Sort: Lot No</option>
          </select>
        </div>
      </div>

      {/* ── ALL PARCHIS TABLE ────────────────────────────────────────────── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: '#6366f1' }} />
            <div style={{ fontSize: '15px', fontWeight: '600' }}>Loading all Parchis & Slips...</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Connecting to database</div>
          </div>
        ) : filteredParchis.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <FileText size={36} style={{ margin: '0 auto 12px', color: '#cbd5e1' }} />
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#334155' }}>No Bills Found</div>
            <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '380px', margin: '6px auto 16px' }}>
              {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Try clearing your search or changing filters to see matching records.'
                : 'No bills found. Click "Generate New Bill No" to create one!'}
            </p>
            {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setTypeFilter('all'); setStatusFilter('all'); }}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 14px', fontWeight: '700', width: '55px' }}>SR #</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700' }}>Bill / Slip No</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Date</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Type</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Lot / Style</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Bill Detail (Specs)</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Receiver & Sup.</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Store Issue Status</th>
                  <th style={{ padding: '14px 18px', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredParchis.map((item, idx) => {
                  const isIssued = item.issueStatus.isIssued;

                  // Type Badges
                  let typeBadgeBg = '#ede9fe';
                  let typeBadgeColor = '#6d28d9';
                  if (item.billType === 'tape') {
                    typeBadgeBg = '#e0f2fe';
                    typeBadgeColor = '#0369a1';
                  } else if (item.billType === 'bone') {
                    typeBadgeBg = '#fef3c7';
                    typeBadgeColor = '#b45309';
                  } else if (item.billType === 'both') {
                    typeBadgeBg = '#f3e8ff';
                    typeBadgeColor = '#7e22ce';
                  }

                  const seriesNumMatch = String(item.billNo).match(/\d+/);
                  const seriesNum = seriesNumMatch ? parseInt(seriesNumMatch[0], 10) : 0;

                  return (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s',
                        background: !isIssued ? '#fffdf7' : 'transparent'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = !isIssued ? '#fffdf7' : 'transparent'}
                    >
                      {/* Column 0: Serial Number (1, 2, 3, 4...) */}
                      <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          color: '#0f172a',
                          padding: '3px 7px',
                          borderRadius: '5px',
                          fontSize: '11.5px',
                          fontFamily: 'monospace',
                          fontWeight: '800'
                        }}>
                          #{idx + 1}
                        </span>
                      </td>

                      {/* Column 1: Bill No */}
                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            fontWeight: '700',
                            color: '#0f172a',
                            background: '#f1f5f9',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.billNo}
                          </span>
                          {seriesNum > 0 && (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: '700',
                              color: '#64748b',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              padding: '2px 5px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap'
                            }}>
                              Series #{seriesNum}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 2: Date */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', color: '#64748b', fontSize: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Calendar size={13} style={{ color: '#94a3b8' }} />
                          <span>{item.date}</span>
                        </div>
                      </td>

                      {/* Column 3: Type */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          background: typeBadgeBg,
                          color: typeBadgeColor,
                          padding: '4px 9px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          display: 'inline-block'
                        }}>
                          {item.typeLabel}
                        </span>
                      </td>

                      {/* Column 4: Lot & Style */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: '#1e293b' }}>
                          {item.isWithoutLot ? (
                            <span style={{ color: '#0284c7', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                              Direct Floor Issue
                            </span>
                          ) : (
                            <span>Lot #{item.lotNo}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          {item.style || item.garmentType} • {item.quantity || 0} Pcs
                        </div>
                      </td>

                      {/* Column 5: Bill Detail (Measurements) */}
                      <td style={{ padding: '14px 16px', minWidth: '220px' }}>
                        {item.billType === 'bone' ? (
                          <div>
                            <div style={{ fontWeight: '700', color: '#b45309' }}>
                              {item.boneRolls || 1} Roll(s) • {item.boneWeightKg || '2.50'} Kg
                            </div>
                            <div style={{ fontSize: '11px', color: '#78350f', marginTop: '2px' }}>
                              Width: {item.boneWidth || '1.5 Inch (Standard)'}
                            </div>
                          </div>
                        ) : item.billType === 'other' ? (
                          <div>
                            <div style={{ fontWeight: '700', color: '#0d9488' }}>
                              {item.otherMaterialName || 'Other Accessory'}: {item.otherRollCount || 1} {item.otherUnit || 'Roll'}
                            </div>
                          </div>
                        ) : (
                          <div>
                            {(item.billType === 'elastic' || item.billType === 'both') && (
                              <div style={{ fontWeight: '700', color: '#4338ca' }}>
                                Elastic: {item.totalElasticMtr} m ({item.elasticRolls} Rolls)
                                <span style={{ fontSize: '11px', fontWeight: '500', color: '#64748b', marginLeft: '6px' }}>
                                  [{item.elasticWidth} • {item.elasticSizeInput} {item.unitType}]
                                </span>
                              </div>
                            )}
                            {(item.billType === 'tape' || item.billType === 'both') && (
                              <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: '600', marginTop: item.billType === 'both' ? '2px' : '0' }}>
                                Tape: {item.totalTapeMtr} m
                                <span style={{ fontSize: '11px', fontWeight: '400', color: '#64748b', marginLeft: '6px' }}>
                                  [{item.tapeWidth}]
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Column 6: Receiver & Supervisor */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '600', color: '#334155', fontSize: '12px' }}>
                          Rec: {item.receiverName || 'ROHIT'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          Sup: {item.supervisorName || 'ROHIT / MONU'}
                        </div>
                      </td>

                      {/* Column 7: Store Status */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        {isIssued ? (
                          <div>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '4px 9px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}>
                              <CheckCircle size={13} />
                              <span>✓ Stock Issued</span>
                            </div>
                            {item.issueStatus.issuedMat && (
                              <div style={{ fontSize: '10px', color: '#166534', marginTop: '3px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.issueStatus.issuedMat}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: '#fef3c7',
                            color: '#b45309',
                            padding: '4px 9px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            <Clock size={13} />
                            <span>⏳ Pending Actual Issue</span>
                          </div>
                        )}
                      </td>

                      {/* Column 8: Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {/* Single Clean Standard Issue Button */}
                          {!isIssued ? (
                            <button
                              onClick={() => handleOpenIssueModal(item)}
                              title="Choose Material & Issue Stock"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '7px 14px',
                                borderRadius: '7px',
                                fontSize: '12px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                boxShadow: '0 3px 10px rgba(37, 99, 235, 0.3)',
                                transition: 'all 0.15s'
                              }}
                            >
                              <Layers size={13} />
                              <span>Issue</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenIssueModal(item)}
                              title="View or Re-Issue Stock"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                padding: '6px 12px',
                                borderRadius: '7px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              <RefreshCw size={12} />
                              <span>Re-Issue</span>
                            </button>
                          )}

                          {/* View Detail */}
                          <button
                            onClick={() => setSelectedBill(item)}
                            title="View Bill Detail"
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={13} />
                          </button>

                          {/* Print PDF */}
                          <button
                            onClick={() => handlePrintParchi(item)}
                            title="Print Bill PDF"
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Printer size={13} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteParchi(item)}
                            title="Delete Bill"
                            style={{
                              background: '#fff1f2',
                              border: '1px solid #fecdd3',
                              color: '#e11d48',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL 1: VIEW BILL DETAILS ───────────────────────────────────── */}
      {selectedBill && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            padding: '28px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Bill Specification & Requisition
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>
                  Bill #{selectedBill.billNo}
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Date: {selectedBill.date} • Type: {selectedBill.typeLabel}
                </div>
              </div>
              <button
                onClick={() => setSelectedBill(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Status Banner */}
            <div style={{
              background: selectedBill.issueStatus.isIssued ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${selectedBill.issueStatus.isIssued ? '#bbf7d0' : '#fde68a'}`,
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedBill.issueStatus.isIssued ? (
                  <CheckCircle size={18} style={{ color: '#16a34a' }} />
                ) : (
                  <Clock size={18} style={{ color: '#d97706' }} />
                )}
                <span style={{ fontSize: '13px', fontWeight: '700', color: selectedBill.issueStatus.isIssued ? '#166534' : '#92400e' }}>
                  {selectedBill.issueStatus.isIssued
                    ? `Real Material Issued & Deducted (${selectedBill.issueStatus.issuedAt || 'Completed'})`
                    : 'Pending Actual Material Issue from Store Inventory'}
                </span>
              </div>
              {!selectedBill.issueStatus.isIssued && (
                <button
                  onClick={() => { const b = selectedBill; setSelectedBill(null); handleOpenIssueModal(b); }}
                  style={{
                    background: '#4338ca',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Issue Now
                </button>
              )}
            </div>

            {/* Section 1: Lot & Production Details */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                Production Information
              </h4>
              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '13px' }}>
                <div><strong>Lot No:</strong> {selectedBill.lotNo}</div>
                <div><strong>Cutting Quantity:</strong> {selectedBill.quantity} Pcs</div>
                <div><strong>Style / Design:</strong> {selectedBill.style}</div>
                <div><strong>Brand / Buyer:</strong> {selectedBill.brand}</div>
                <div><strong>Garment Type:</strong> {selectedBill.garmentType}</div>
                <div><strong>Fabric / Shade:</strong> {selectedBill.fabric} / {selectedBill.shade}</div>
              </div>
            </div>

            {/* Section 2: Bill Item Particulars */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                Material Breakdown & Formula
              </h4>
              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                {selectedBill.billType === 'bone' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div><strong>Bone Width:</strong> {selectedBill.boneWidth || '1.5 Inch (Standard)'}</div>
                    <div><strong>Total Weight:</strong> {selectedBill.boneWeightKg || '2.50'} Kg</div>
                    <div><strong>Rolls:</strong> {selectedBill.boneRolls || 1} Roll(s)</div>
                    <div><strong>Material:</strong> {selectedBill.boneMaterialName || 'Bone Chinese (Beige)'}</div>
                    {selectedBill.quantity > 0 && <div><strong>Requisition Qty:</strong> {selectedBill.quantity} Pcs</div>}
                  </div>
                ) : selectedBill.billType === 'other' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div><strong>Accessory:</strong> {selectedBill.otherMaterialName || 'Other Accessory'}</div>
                    <div><strong>Quantity:</strong> {selectedBill.otherRollCount || 1} {selectedBill.otherUnit || 'Roll'}</div>
                    {selectedBill.quantity > 0 && <div><strong>Requisition Qty:</strong> {selectedBill.quantity} Pcs</div>}
                  </div>
                ) : (
                  <div>
                    {(selectedBill.billType === 'elastic' || selectedBill.billType === 'both') && (
                      <div style={{ marginBottom: selectedBill.billType === 'both' ? '12px' : '0' }}>
                        <div style={{ fontWeight: '700', color: '#4338ca', marginBottom: '6px' }}>• Elastic Waistband:</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', paddingLeft: '8px' }}>
                          <div><strong>Width:</strong> {selectedBill.elasticWidth}</div>
                          <div><strong>Cut Size:</strong> {selectedBill.elasticSizeInput} {selectedBill.unitType}</div>
                          <div><strong>Per Pc Mtr:</strong> {selectedBill.elasticPerPcMtr} m</div>
                          <div><strong>Total Required:</strong> {selectedBill.totalElasticMtr} Meters</div>
                          <div><strong>Rolls:</strong> {selectedBill.elasticRolls} Roll(s)</div>
                        </div>
                      </div>
                    )}
                    {(selectedBill.billType === 'tape' || selectedBill.billType === 'both') && (
                      <div>
                        <div style={{ fontWeight: '700', color: '#0284c7', marginBottom: '6px' }}>• Tape / Lace:</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', paddingLeft: '8px' }}>
                          <div><strong>Tape Width:</strong> {selectedBill.tapeWidth}</div>
                          <div><strong>Tape Cut Size:</strong> {selectedBill.tapeSizeInput || '—'} CM</div>
                          <div><strong>Per Pc Tape Mtr:</strong> {selectedBill.tapePerPcMtr} m</div>
                          <div><strong>Total Tape Mtr:</strong> {selectedBill.totalTapeMtr} Meters</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: People */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                Parties & Signatories
              </h4>
              <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: '#64748b' }}>Issued By (Store):</div>
                  <div style={{ fontWeight: '700', marginTop: '2px' }}>{selectedBill.issuerName}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b' }}>Received By (Floor):</div>
                  <div style={{ fontWeight: '700', marginTop: '2px' }}>{selectedBill.receiverName}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b' }}>Supervisor:</div>
                  <div style={{ fontWeight: '700', marginTop: '2px' }}>{selectedBill.supervisorName}</div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => handlePrintParchi(selectedBill)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <Printer size={15} />
                <span>Print Bill PDF</span>
              </button>
              <button
                onClick={() => setSelectedBill(null)}
                style={{
                  background: '#1e293b',
                  border: 'none',
                  color: '#ffffff',
                  padding: '9px 20px',
                  borderRadius: '8px',
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
      )}

      {/* ── MODAL 2: ISSUE ACTUAL REAL MATERIAL & DEDUCT FROM STORE ───────── */}
      {issueModalBill && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            maxWidth: '720px',
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            padding: '28px'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ background: '#10b981', color: '#ffffff', fontSize: '11px', fontWeight: '800', padding: '3px 8px', borderRadius: '6px' }}>
                    REAL STORE INVENTORY ISSUE
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>
                    {issueModalBill.isWithoutLot ? 'Direct Floor Issue' : `Lot #${issueModalBill.lotNo}`}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#1e293b' }}>
                  Issue Actual Material for Bill #{issueModalBill.billNo}
                </h3>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '3px' }}>
                  Style: {issueModalBill.style} • Quantity: {issueModalBill.quantity || 0} Pcs • Receiver: {issueModalBill.receiverName || 'ROHIT'}
                </div>
              </div>
              <button
                onClick={() => setIssueModalBill(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Banner Notice */}
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              border: '1px solid #bfdbfe',
              padding: '14px 18px',
              borderRadius: '12px',
              fontSize: '13px',
              color: '#1e40af',
              marginBottom: '20px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
              <Database size={22} style={{ color: '#2563eb', flexShrink: 0 }} />
              <div>
                <strong>Actual Stock Deduction:</strong> Selecting the material below will directly reduce the live stock in the MySQL store inventory (`materials` table) and generate an official issue transaction.
              </div>
            </div>

            {/* Material 1: Elastic Actual Issue */}
            {(issueModalBill.billType === 'elastic' || issueModalBill.billType === 'both') && (() => {
              const selectedElastic = materials.find(m => String(m.id) === String(issueForm.elasticMaterialId));
              const qty = parseFloat(issueForm.customElasticQty) || 0;
              const curStock = selectedElastic ? (selectedElastic.stock || 0) : 0;
              const remStock = Math.max(0, Math.round((curStock - qty) * 100) / 100);
              const isLowStock = curStock < qty;

              return (
                <div style={{ border: '2px solid #818cf8', background: '#faf5ff', borderRadius: '14px', padding: '18px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#4338ca' }}>
                      1. Elastic Actual Material Issue:
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '700', background: '#ede9fe', color: '#6d28d9', padding: '3px 10px', borderRadius: '6px' }}>
                      Bill Required: {issueModalBill.totalElasticMtr} m ({issueModalBill.elasticRolls} Rolls) [Width: {issueModalBill.elasticWidth}]
                    </span>
                  </div>

                  {/* Searchable Material Chooser with Photo, Category, Stock & Location */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>
                      Choose Real Elastic Stock Item from Store Inventory:
                    </label>
                    <SearchableMaterialSelect
                      materials={inventoryElastic}
                      value={issueForm.elasticMaterialId}
                      onChange={(val) => setIssueForm({ ...issueForm, elasticMaterialId: val })}
                      placeholder="🔍 Choose Real Elastic Stock Item..."
                      componentHint={issueModalBill.elasticWidth ? `Elastic ${issueModalBill.elasticWidth}` : 'Elastic Waistband'}
                      recommendedMaterials={(() => {
                        const best = getBestElasticMaterial(issueModalBill.elasticWidth, qty);
                        return best ? [best] : [];
                      })()}
                      reqQty={qty}
                      onPreviewPhoto={(url) => setPreviewPhotoUrl(url)}
                    />
                  </div>

                  {/* ── PHOTO & CATEGORY VERIFICATION CARD ─────────────────────── */}
                  {selectedElastic && (
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      border: isLowStock ? '2px solid #fca5a5' : '1.5px solid #c7d2fe',
                      padding: '12px 14px',
                      marginBottom: '12px',
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}>
                      {/* Photo Thumbnail */}
                      <div
                        onClick={() => selectedElastic.imageUrl && setPreviewPhotoUrl(selectedElastic.imageUrl)}
                        title={selectedElastic.imageUrl ? 'Click to Zoom Photo' : 'No photo uploaded'}
                        style={{
                          width: '74px',
                          height: '74px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '2px solid #cbd5e1',
                          background: '#f8fafc',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          cursor: selectedElastic.imageUrl ? 'pointer' : 'default'
                        }}
                      >
                        {selectedElastic.imageUrl ? (
                          <>
                            <img
                              src={getCleanImageUrl(selectedElastic.imageUrl)}
                              alt={selectedElastic.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div style={{
                              position: 'absolute',
                              bottom: '2px',
                              right: '2px',
                              background: 'rgba(0,0,0,0.6)',
                              color: '#ffffff',
                              borderRadius: '4px',
                              padding: '2px 3px',
                              fontSize: '8px',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              <Eye size={10} />
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                            <Package size={22} />
                            <div style={{ fontSize: '8px', fontWeight: '800', marginTop: '2px' }}>NO PHOTO</div>
                          </div>
                        )}
                      </div>

                      {/* Material Specs & Category Tag */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                          <span style={{
                            background: '#ede9fe',
                            color: '#6d28d9',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 7px',
                            borderRadius: '5px'
                          }}>
                            🏷️ CATEGORY: {selectedElastic.category || 'ELASTIC'}
                          </span>
                          <span style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 7px',
                            borderRadius: '5px'
                          }}>
                            CODE: {selectedElastic.itemCode || selectedElastic.id}
                          </span>
                          {selectedElastic.color && (
                            <span style={{
                              background: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #e2e8f0',
                              fontSize: '11px',
                              fontWeight: '600',
                              padding: '2px 6px',
                              borderRadius: '5px'
                            }}>
                              🎨 {selectedElastic.color}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedElastic.name}
                        </div>

                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          📍 <strong>Store Location:</strong> {selectedElastic.location || 'Main Store - RACK 212'}
                        </div>
                      </div>

                      {/* Stock Status Badge */}
                      <div style={{
                        background: isLowStock ? '#fef2f2' : '#f0fdf4',
                        border: `1px solid ${isLowStock ? '#fecaca' : '#bbf7d0'}`,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        textAlign: 'right',
                        flexShrink: 0
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: isLowStock ? '#b91c1c' : '#15803d' }}>
                          {isLowStock ? '⚠️ LOW STOCK' : '✓ AVAILABLE'}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '900', color: isLowStock ? '#dc2626' : '#166534', marginTop: '1px' }}>
                          {curStock} {selectedElastic.unit || 'Roll'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
                          After Issue: <strong>{remStock} {selectedElastic.unit || 'Roll'}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                      Actual Quantity to Deduct from Stock ({selectedElastic?.unit || 'Rolls / Meters'}):
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={issueForm.customElasticQty}
                      onChange={(e) => setIssueForm({ ...issueForm, customElasticQty: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '700' }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Material 2: Tape Actual Issue */}
            {(issueModalBill.billType === 'tape' || issueModalBill.billType === 'both') && (() => {
              const selectedTape = materials.find(m => String(m.id) === String(issueForm.tapeMaterialId));
              const qty = parseFloat(issueForm.customTapeQty) || 0;
              const curStock = selectedTape ? (selectedTape.stock || 0) : 0;
              const remStock = Math.max(0, Math.round((curStock - qty) * 100) / 100);
              const isLowStock = curStock < qty;

              return (
                <div style={{ border: '2px solid #38bdf8', background: '#f0f9ff', borderRadius: '14px', padding: '18px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#0284c7' }}>
                      2. Tape / Lace Actual Material Issue:
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '700', background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: '6px' }}>
                      Bill Required: {issueModalBill.totalTapeMtr} Meters [Width: {issueModalBill.tapeWidth}]
                    </span>
                  </div>

                  {/* Searchable Material Chooser with Photo, Category, Stock & Location */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>
                      Choose Real Tape Stock Item from Store Inventory:
                    </label>
                    <SearchableMaterialSelect
                      materials={inventoryTape}
                      value={issueForm.tapeMaterialId}
                      onChange={(val) => setIssueForm({ ...issueForm, tapeMaterialId: val })}
                      placeholder="🔍 Choose Real Tape Stock Item..."
                      componentHint={issueModalBill.tapeWidth ? `Tape ${issueModalBill.tapeWidth}` : 'Tape / Lace'}
                      recommendedMaterials={(() => {
                        const best = getBestTapeMaterial(issueModalBill.tapeWidth, qty);
                        return best ? [best] : [];
                      })()}
                      reqQty={qty}
                      onPreviewPhoto={(url) => setPreviewPhotoUrl(url)}
                    />
                  </div>

                  {/* ── PHOTO & CATEGORY VERIFICATION CARD ─────────────────────── */}
                  {selectedTape && (
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      border: isLowStock ? '2px solid #fca5a5' : '1.5px solid #7dd3fc',
                      padding: '12px 14px',
                      marginBottom: '12px',
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}>
                      {/* Photo Thumbnail */}
                      <div
                        onClick={() => selectedTape.imageUrl && setPreviewPhotoUrl(selectedTape.imageUrl)}
                        title={selectedTape.imageUrl ? 'Click to Zoom Photo' : 'No photo uploaded'}
                        style={{
                          width: '74px',
                          height: '74px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '2px solid #cbd5e1',
                          background: '#f8fafc',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          cursor: selectedTape.imageUrl ? 'pointer' : 'default'
                        }}
                      >
                        {selectedTape.imageUrl ? (
                          <>
                            <img
                              src={getCleanImageUrl(selectedTape.imageUrl)}
                              alt={selectedTape.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div style={{
                              position: 'absolute',
                              bottom: '2px',
                              right: '2px',
                              background: 'rgba(0,0,0,0.6)',
                              color: '#ffffff',
                              borderRadius: '4px',
                              padding: '2px 3px',
                              fontSize: '8px',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              <Eye size={10} />
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                            <Package size={22} />
                            <div style={{ fontSize: '8px', fontWeight: '800', marginTop: '2px' }}>NO PHOTO</div>
                          </div>
                        )}
                      </div>

                      {/* Material Specs & Category Tag */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                          <span style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 7px',
                            borderRadius: '5px'
                          }}>
                            🏷️ CATEGORY: {selectedTape.category || 'TAPE / LACE'}
                          </span>
                          <span style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 7px',
                            borderRadius: '5px'
                          }}>
                            CODE: {selectedTape.itemCode || selectedTape.id}
                          </span>
                          {selectedTape.color && (
                            <span style={{
                              background: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #e2e8f0',
                              fontSize: '11px',
                              fontWeight: '600',
                              padding: '2px 6px',
                              borderRadius: '5px'
                            }}>
                              🎨 {selectedTape.color}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedTape.name}
                        </div>

                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          📍 <strong>Store Location:</strong> {selectedTape.location || 'Main Store - RACK 200'}
                        </div>
                      </div>

                      {/* Stock Status Badge */}
                      <div style={{
                        background: isLowStock ? '#fef2f2' : '#f0fdf4',
                        border: `1px solid ${isLowStock ? '#fecaca' : '#bbf7d0'}`,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        textAlign: 'right',
                        flexShrink: 0
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: isLowStock ? '#b91c1c' : '#15803d' }}>
                          {isLowStock ? '⚠️ LOW STOCK' : '✓ AVAILABLE'}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '900', color: isLowStock ? '#dc2626' : '#166534', marginTop: '1px' }}>
                          {curStock} {selectedTape.unit || 'Mtr'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
                          After Issue: <strong>{remStock} {selectedTape.unit || 'Mtr'}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                      Actual Quantity to Deduct from Stock ({selectedTape?.unit || 'Meters'}):
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={issueForm.customTapeQty}
                      onChange={(e) => setIssueForm({ ...issueForm, customTapeQty: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '700' }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Material 3: Bone Actual Issue */}
            {issueModalBill.billType === 'bone' && (() => {
              const selectedBone = materials.find(m => String(m.id) === String(issueForm.boneMaterialId));
              const qty = parseFloat(issueForm.customBoneQty) || 0;
              const curStock = selectedBone ? (selectedBone.stock || 0) : 0;
              const remStock = Math.max(0, Math.round((curStock - qty) * 100) / 100);
              const isLowStock = curStock < qty;

              return (
                <div style={{ border: '2px solid #f59e0b', background: '#fffbeb', borderRadius: '14px', padding: '18px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#b45309' }}>
                      Bone / Piping Actual Material Issue:
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '700', background: '#fef3c7', color: '#b45309', padding: '3px 10px', borderRadius: '6px' }}>
                      Bill Required: {issueModalBill.boneWeightKg} Kg ({issueModalBill.boneRolls} Rolls) [Width: {issueModalBill.boneWidth}]
                    </span>
                  </div>

                  {/* Searchable Material Chooser with Photo, Category, Stock & Location */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>
                      Choose Real Bone Stock Item from Store Inventory:
                    </label>
                    <SearchableMaterialSelect
                      materials={inventoryBone}
                      value={issueForm.boneMaterialId}
                      onChange={(val) => setIssueForm({ ...issueForm, boneMaterialId: val })}
                      placeholder="🔍 Choose Real Bone Stock Item..."
                      componentHint="Bone / Piping"
                      recommendedMaterials={(() => {
                        const best = getBestBoneMaterial(qty);
                        return best ? [best] : [];
                      })()}
                      reqQty={qty}
                      onPreviewPhoto={(url) => setPreviewPhotoUrl(url)}
                    />
                  </div>

                  {/* ── PHOTO & CATEGORY VERIFICATION CARD ─────────────────────── */}
                  {selectedBone && (
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      border: isLowStock ? '2px solid #fca5a5' : '1.5px solid #fcd34d',
                      padding: '12px 14px',
                      marginBottom: '12px',
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}>
                      {/* Photo Thumbnail */}
                      <div
                        onClick={() => selectedBone.imageUrl && setPreviewPhotoUrl(selectedBone.imageUrl)}
                        title={selectedBone.imageUrl ? 'Click to Zoom Photo' : 'No photo uploaded'}
                        style={{
                          width: '74px',
                          height: '74px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '2px solid #cbd5e1',
                          background: '#f8fafc',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          cursor: selectedBone.imageUrl ? 'pointer' : 'default'
                        }}
                      >
                        {selectedBone.imageUrl ? (
                          <>
                            <img
                              src={getCleanImageUrl(selectedBone.imageUrl)}
                              alt={selectedBone.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div style={{
                              position: 'absolute',
                              bottom: '2px',
                              right: '2px',
                              background: 'rgba(0,0,0,0.6)',
                              color: '#ffffff',
                              borderRadius: '4px',
                              padding: '2px 3px',
                              fontSize: '8px',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              <Eye size={10} />
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                            <Package size={22} />
                            <div style={{ fontSize: '8px', fontWeight: '800', marginTop: '2px' }}>NO PHOTO</div>
                          </div>
                        )}
                      </div>

                      {/* Material Specs & Category Tag */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                          <span style={{
                            background: '#fef3c7',
                            color: '#b45309',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 7px',
                            borderRadius: '5px'
                          }}>
                            🏷️ CATEGORY: {selectedBone.category || 'BONE / PIPING'}
                          </span>
                          <span style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 7px',
                            borderRadius: '5px'
                          }}>
                            CODE: {selectedBone.itemCode || selectedBone.id}
                          </span>
                          {selectedBone.color && (
                            <span style={{
                              background: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #e2e8f0',
                              fontSize: '11px',
                              fontWeight: '600',
                              padding: '2px 6px',
                              borderRadius: '5px'
                            }}>
                              🎨 {selectedBone.color}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedBone.name}
                        </div>

                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          📍 <strong>Store Location:</strong> {selectedBone.location || 'Main Store - RACK 208'}
                        </div>
                      </div>

                      {/* Stock Status Badge */}
                      <div style={{
                        background: isLowStock ? '#fef2f2' : '#f0fdf4',
                        border: `1px solid ${isLowStock ? '#fecaca' : '#bbf7d0'}`,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        textAlign: 'right',
                        flexShrink: 0
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: isLowStock ? '#b91c1c' : '#15803d' }}>
                          {isLowStock ? '⚠️ LOW STOCK' : '✓ AVAILABLE'}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '900', color: isLowStock ? '#dc2626' : '#166534', marginTop: '1px' }}>
                          {curStock} {selectedBone.unit || 'Roll'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
                          After Issue: <strong>{remStock} {selectedBone.unit || 'Roll'}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
                      Actual Quantity to Deduct from Stock ({selectedBone?.unit || 'Rolls / Kg'}):
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={issueForm.customBoneQty}
                      onChange={(e) => setIssueForm({ ...issueForm, customBoneQty: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '700' }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Receiver & Destination Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  Receiver Name (Cutting Floor):
                </label>
                <input
                  type="text"
                  value={issueForm.receiverName}
                  onChange={(e) => setIssueForm({ ...issueForm, receiverName: e.target.value })}
                  placeholder="e.g. ROHIT / MONU"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  Department:
                </label>
                <select
                  value={issueForm.receiverDept}
                  onChange={(e) => setIssueForm({ ...issueForm, receiverDept: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600' }}
                >
                  <option value="CUTTING">CUTTING FLOOR</option>
                  <option value="STITCHING">STITCHING DEPT</option>
                  <option value="FINISHING">FINISHING</option>
                </select>
              </div>
            </div>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIssueModalBill(null)}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '11px 20px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmIssueMaterial}
                disabled={isIssuing}
                style={{
                  background: 'linear-gradient(135deg, #16a34a, #10b981)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '11px 28px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isIssuing ? <RefreshCw size={16} className="animate-spin" /> : <CheckCheck size={16} />}
                <span>{isIssuing ? 'Deducting Stock from Inventory...' : '⚡ Confirm & Deduct Real Stock Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Verification Zoom Lightbox Modal ───────────────────────── */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999999,
            padding: '24px',
            cursor: 'zoom-out'
          }}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '92vh',
              background: '#ffffff',
              borderRadius: '16px',
              padding: '12px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 4px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569', letterSpacing: '0.5px' }}>
                📸 MATERIAL PHOTO VERIFICATION
              </span>
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569'
                }}
              >
                <X size={16} />
              </button>
            </div>
            <img
              src={getCleanImageUrl(previewPhotoUrl)}
              alt="Material Zoom"
              style={{
                maxWidth: '85vw',
                maxHeight: '80vh',
                borderRadius: '10px',
                objectFit: 'contain',
                display: 'block'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
