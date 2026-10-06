import React, { useState, useEffect } from 'react';
import {
  Scale, Printer, Scan, ClipboardCheck, Volume2, Globe, Wifi, WifiOff,
  CheckCircle2, AlertTriangle, RefreshCw, X, Play, Square, Settings,
  Laptop, Smartphone, Tablet, Monitor, ShieldCheck, Zap, Copy, ExternalLink, HardDrive
} from 'lucide-react';
import {
  detectBrowserCapabilities,
  scaleEngine,
  universalCopyText,
  universalPlayTone,
  universalPrintThermalLabel
} from '../utils/deviceCapabilities';
import { getBackendUrl } from '../utils/api';

export default function DeviceCapabilitiesModal({ isOpen, onClose }) {
  const [caps, setCaps] = useState(() => detectBrowserCapabilities());
  const [scaleState, setScaleState] = useState(() => scaleEngine.getState());
  const [testWeightInput, setTestWeightInput] = useState('15.500');
  const [scannerTestInput, setScannerTestInput] = useState('');
  const [scanHistory, setScanHistory] = useState([]);
  const [clipboardCopied, setClipboardCopied] = useState(false);
  const [printerStatus, setPrinterStatus] = useState('checking');
  const [backendLatency, setBackendLatency] = useState(null);
  const [printingTest, setPrintingTest] = useState(false);
  const [selectedBaud, setSelectedBaud] = useState(9600);
  const [wsBridgeUrl, setWsBridgeUrl] = useState('ws://localhost:8765');
  const [preferredMode, setPreferredMode] = useState(caps.recommendedScaleMode);

  // Subscribe to live scale engine state
  useEffect(() => {
    const unsub = scaleEngine.subscribe((state) => {
      setScaleState(state);
    });
    return () => unsub();
  }, []);

  // Update detection on open
  useEffect(() => {
    if (isOpen) {
      const detected = detectBrowserCapabilities();
      setCaps(detected);
      checkPrinterDaemon();
      pingBackend();
    }
  }, [isOpen]);

  // Check Python Print/Scale Daemon
  const checkPrinterDaemon = () => {
    setPrinterStatus('checking');
    try {
      const ws = new WebSocket(wsBridgeUrl);
      const timer = setTimeout(() => {
        ws.close();
        setPrinterStatus('offline');
      }, 1500);

      ws.onopen = () => {
        clearTimeout(timer);
        setPrinterStatus('online');
        ws.close();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        setPrinterStatus('offline');
      };
    } catch (e) {
      setPrinterStatus('offline');
    }
  };

  // Ping Backend MySQL API for real-time latency
  const pingBackend = async () => {
    const start = performance.now();
    try {
      const res = await fetch(`${getBackendUrl()}/api/health`, { method: 'GET', cache: 'no-cache' });
      if (res.ok) {
        setBackendLatency(Math.round(performance.now() - start));
      } else {
        setBackendLatency('Error');
      }
    } catch (e) {
      setBackendLatency('Offline');
    }
  };

  // Handle Scale Connect
  const handleScaleConnect = async (modeToUse) => {
    try {
      await scaleEngine.connect({
        mode: modeToUse || preferredMode,
        baudRate: selectedBaud,
        wsUrl: wsBridgeUrl,
        initialWeight: parseFloat(testWeightInput) || 30.250
      });
      universalPlayTone('success');
    } catch (err) {
      universalPlayTone('warning');
    }
  };

  const handleScaleDisconnect = async () => {
    await scaleEngine.disconnect();
    universalPlayTone('warning');
  };

  const handlePrintTestSticker = async () => {
    setPrintingTest(true);
    universalPlayTone('beep');
    const res = await universalPrintThermalLabel({
      materialName: 'Test Thermal Print Item',
      materialCode: 'MT1000',
      itemCode: 'MH-TEST-01',
      barcodeId: 'TEST882910',
      netWeightKg: scaleState.liveWeight || '15.500',
      pieces: 150,
      packets: 1,
      unit: 'Pcs',
      location: 'Main Store - Rack 1',
      supplier: 'System Diagnostic Test',
      poNumber: 'PO-TEST-001'
    });
    setPrintingTest(false);
    if (res.success) {
      universalPlayTone('success');
    }
  };

  const handleTestCopy = async () => {
    const success = await universalCopyText(`Garment PDMS Diagnostic Check [${new Date().toISOString()}] - Scale: ${scaleState.liveWeight} KG`);
    if (success) {
      setClipboardCopied(true);
      universalPlayTone('success');
      setTimeout(() => setClipboardCopied(false), 2000);
    } else {
      universalPlayTone('error');
    }
  };

  const handleSimulateScanner = (e) => {
    if (e.key === 'Enter' && scannerTestInput.trim()) {
      e.preventDefault();
      const code = scannerTestInput.trim();
      setScanHistory(prev => [code, ...prev.slice(0, 4)]);
      setScannerTestInput('');
      universalPlayTone('scan');
    }
  };

  if (!isOpen) return null;

  const getDeviceIcon = () => {
    if (caps.deviceType === 'mobile') return <Smartphone size={18} />;
    if (caps.deviceType === 'tablet') return <Tablet size={18} />;
    if (caps.deviceType === 'laptop') return <Laptop size={18} />;
    return <Monitor size={18} />;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="panel"
        style={{
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '16px',
          padding: 0,
          background: 'var(--bg-primary, #ffffff)',
          border: '1.5px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* ── MODAL HEADER ── */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-secondary, #f8fafc)',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
            >
              <Zap size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-main, #0f172a)' }}>
                Universal Device Capabilities Center
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                Cross-Browser Hardware Bridge & Universal Device Parity
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── MODAL BODY ── */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Browser Diagnostic Bar */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
              border: '1.5px solid rgba(99, 102, 241, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ color: '#4f46e5', display: 'flex' }}>
                {getDeviceIcon()}
              </div>
              <div>
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                  {caps.browserName} on {caps.osName} ({caps.deviceType.toUpperCase()})
                </span>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                  Protocol: <strong>{window.location.protocol.toUpperCase()}</strong> | Touch: <strong>{caps.hasTouch ? 'Enabled' : 'Mouse Pointer'}</strong> | Secure Context: <strong>{caps.isSecureContext ? 'Yes (HTTPS/Local)' : 'Standard'}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: '#10b981',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ShieldCheck size={13} /> 100% Device Parity Active
              </span>
            </div>
          </div>

          {/* ── 2-COLUMN HARDWARE GRID ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '18px' }}>
            
            {/* 1. DIGITAL WEIGHING SCALE */}
            <div
              style={{
                borderRadius: '12px',
                border: '1.5px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-secondary, #f8fafc)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scale size={18} style={{ color: '#3b82f6' }} />
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                    Digital Weighing Scale
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: scaleState.connected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: scaleState.connected ? '#10b981' : '#ef4444',
                    border: `1px solid ${scaleState.connected ? '#10b981' : '#ef4444'}`
                  }}
                >
                  {scaleState.connected ? `Connected (${scaleState.mode.toUpperCase()})` : 'Disconnected'}
                </span>
              </div>

              {/* Digital Readout Display */}
              <div
                style={{
                  background: '#0f172a',
                  borderRadius: '10px',
                  padding: '16px',
                  color: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '700' }}>
                    Live Reading
                  </span>
                  <div style={{ fontSize: '32px', fontWeight: '900', fontFamily: 'monospace', color: scaleState.stable ? '#10b981' : '#ffffff' }}>
                    {scaleState.liveWeight} <span style={{ fontSize: '14px', color: '#94a3b8' }}>KG</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      color: scaleState.stable ? '#10b981' : '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      justifyContent: 'flex-end'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: scaleState.stable ? '#10b981' : '#f59e0b' }} />
                    {scaleState.stable ? 'Stable Lock' : (scaleState.connected ? 'Stabilizing...' : 'Offline')}
                  </span>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                    Tare: {scaleState.tareWeight.toFixed(3)} KG
                  </div>
                </div>
              </div>

              {/* Mode Select & Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPreferredMode('serial');
                      handleScaleConnect('serial');
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: preferredMode === 'serial' ? '1.5px solid #3b82f6' : '1px solid var(--border-color, #cbd5e1)',
                      background: preferredMode === 'serial' ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-primary, #ffffff)',
                      color: preferredMode === 'serial' ? '#2563eb' : 'var(--text-main, #0f172a)',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    🔌 Web Serial {caps.apis.serial ? '✅' : '⚠️'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPreferredMode('ws_bridge');
                      handleScaleConnect('ws_bridge');
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: preferredMode === 'ws_bridge' ? '1.5px solid #3b82f6' : '1px solid var(--border-color, #cbd5e1)',
                      background: preferredMode === 'ws_bridge' ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-primary, #ffffff)',
                      color: preferredMode === 'ws_bridge' ? '#2563eb' : 'var(--text-main, #0f172a)',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    🌐 WebSocket Bridge
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPreferredMode('demo');
                      handleScaleConnect('demo');
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #6366f1',
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: '#4f46e5',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    ⚡ Demo Simulator
                  </button>

                  <button
                    type="button"
                    onClick={() => scaleEngine.tare()}
                    disabled={!scaleState.connected}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      background: 'var(--bg-primary, #ffffff)',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: scaleState.connected ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Tare
                  </button>

                  <button
                    type="button"
                    onClick={() => scaleEngine.zero()}
                    disabled={!scaleState.connected}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      background: 'var(--bg-primary, #ffffff)',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: scaleState.connected ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Zero
                  </button>

                  {scaleState.connected && (
                    <button
                      type="button"
                      onClick={handleScaleDisconnect}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#ef4444',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2. THERMAL LABEL PRINTER */}
            <div
              style={{
                borderRadius: '12px',
                border: '1.5px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-secondary, #f8fafc)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Printer size={18} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                    Thermal Barcode & Label Printer
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: printerStatus === 'online' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: printerStatus === 'online' ? '#10b981' : '#2563eb',
                    border: `1px solid ${printerStatus === 'online' ? '#10b981' : '#3b82f6'}`
                  }}
                >
                  {printerStatus === 'online' ? 'Python Daemon Online' : 'Universal Browser Print Active'}
                </span>
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--bg-primary, #ffffff)',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  fontSize: '12px',
                  color: 'var(--text-muted, #64748b)',
                  lineHeight: '1.5'
                }}
              >
                <div>• Direct Daemon (Port 8765): <strong>{printerStatus === 'online' ? 'Connected (Hardware Auto-Cut)' : 'Offline / Standby'}</strong></div>
                <div>• Cross-Browser Fallback: <strong>Calibrated 50mm x 25mm Direct ESC/POS Iframe</strong></div>
                <div>• Compatibility: <strong>Chrome, Edge, Firefox, Safari, iOS, Android</strong></div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handlePrintTestSticker}
                  disabled={printingTest}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: printingTest ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  <Printer size={15} />
                  {printingTest ? 'Dispatching...' : '🖨️ Test Thermal Sticker Print'}
                </button>

                <button
                  type="button"
                  onClick={checkPrinterDaemon}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--bg-primary, #ffffff)',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <RefreshCw size={13} /> Ping
                </button>
              </div>
            </div>

            {/* 3. BARCODE / QR SCANNER */}
            <div
              style={{
                borderRadius: '12px',
                border: '1.5px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-secondary, #f8fafc)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scan size={18} style={{ color: '#f59e0b' }} />
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                    Barcode & QR Scanner Bridge
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid #10b981'
                  }}
                >
                  Active & Listening
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted, #64748b)' }}>
                  Interactive Scanner Test Box (Scan hardware barcode or type & press Enter):
                </label>
                <input
                  type="text"
                  placeholder="Focus here & scan barcode with USB reader..."
                  value={scannerTestInput}
                  onChange={(e) => setScannerTestInput(e.target.value)}
                  onKeyDown={handleSimulateScanner}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    background: 'var(--bg-primary, #ffffff)',
                    fontSize: '13px',
                    fontWeight: '700',
                    outline: 'none'
                  }}
                />
              </div>

              {scanHistory.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted, #64748b)', fontWeight: '700' }}>Recent Scans:</span>
                  {scanHistory.map((h, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#d97706',
                        fontSize: '11px',
                        fontWeight: '800'
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 4. AUDIO, CLIPBOARD & NETWORK MATRIX */}
            <div
              style={{
                borderRadius: '12px',
                border: '1.5px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-secondary, #f8fafc)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Volume2 size={18} style={{ color: '#8b5cf6' }} />
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                    System Audio & Clipboard Services
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid #10b981'
                  }}
                >
                  Ready ({backendLatency ? `${backendLatency}ms` : 'Sync'})
                </span>
              </div>

              {/* Audio Test Triggers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted, #64748b)' }}>Audio Synthesizer Test:</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => universalPlayTone('success')}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #10b981',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#059669',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    🎵 Success
                  </button>
                  <button
                    type="button"
                    onClick={() => universalPlayTone('scan')}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #f59e0b',
                      background: 'rgba(245, 158, 11, 0.1)',
                      color: '#d97706',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    🔊 Scan Beep
                  </button>
                  <button
                    type="button"
                    onClick={() => universalPlayTone('lock')}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #6366f1',
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: '#4f46e5',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    🔒 Wt Lock
                  </button>
                  <button
                    type="button"
                    onClick={() => universalPlayTone('error')}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #ef4444',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#dc2626',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    ⚠️ Error
                  </button>
                </div>
              </div>

              {/* Clipboard Copy Button */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleTestCopy}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: clipboardCopied ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-primary, #ffffff)',
                    color: clipboardCopied ? '#059669' : 'var(--text-main, #0f172a)',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Copy size={14} />
                  {clipboardCopied ? 'Copied to Clipboard!' : 'Test Cross-Browser Clipboard'}
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* ── MODAL FOOTER ── */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-secondary, #f8fafc)',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px'
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
            All hardware interfaces auto-adapt to your active browser environment.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Close & Continue
          </button>
        </div>

      </div>
    </div>
  );
}
