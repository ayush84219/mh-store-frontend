import React, { useState, useEffect, useMemo } from "react";
import "./PoDashboard.css";
import { getBackendUrl } from "../utils/api";
import {
  generatePurchaseOrderPDF,
  downloadPdfBlob,
  buildPoQrUrls,
  toDataURL_QR
} from "./GeneratePOView";

// Local Storage Keys
const PO_DASH_KEYS = {
  API_KEY: "po_dash_api_key",
  SPREADSHEET_ID: "po_dash_spreadsheet_id",
  GST_ENABLED: "po_dash_gst_enabled",
  GST_PERCENTAGE: "po_dash_gst_percentage",
  SHADE_ENABLED: "po_dash_shade_enabled"
};

// Default Values from Environment
const DEFAULT_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "";
const DEFAULT_SPREADSHEET_ID = import.meta.env.VITE_PO_SPREADSHEET_ID || "";

export default function StandardPoRedownload() {
  // Settings State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(PO_DASH_KEYS.API_KEY) || DEFAULT_API_KEY);
  const [spreadsheetId, setSpreadsheetId] = useState(() => localStorage.getItem(PO_DASH_KEYS.SPREADSHEET_ID) || DEFAULT_SPREADSHEET_ID);

  // PDF Options State
  const [gstEnabled, setGstEnabled] = useState(() => JSON.parse(localStorage.getItem(PO_DASH_KEYS.GST_ENABLED) || "false"));
  const [gstPercentage, setGstPercentage] = useState(() => parseFloat(localStorage.getItem(PO_DASH_KEYS.GST_PERCENTAGE) || "18"));
  const [shadeEnabled, setShadeEnabled] = useState(() => JSON.parse(localStorage.getItem(PO_DASH_KEYS.SHADE_ENABLED) || "false"));

  // Dialog State
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [tempSpreadsheetId, setTempSpreadsheetId] = useState(spreadsheetId);

  // Data State
  const [poMain, setPoMain] = useState([]);
  const [poItems, setPoItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPoNumber, setSelectedPoNumber] = useState(null);

  // Search/Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [lotFilter, setLotFilter] = useState("ALL"); // "ALL", "WITH_LOT", "WITHOUT_LOT"

  // PDF Generation loading state
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Syncing state
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncedAt, setSyncedAt] = useState(null);

  // Fetch Sheets Data from MySQL backend (with fallback to direct Google Sheets API)
  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Primary: Fast instant fetch from MySQL old_purchase_orders table
      try {
        const dbRes = await fetch(`${getBackendUrl()}/api/old-pos?limit=3500`);
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          if (dbData.records && dbData.records.length > 0) {
            setPoMain(dbData.records);
            if (dbData.records[0]?.synced_at) {
              setSyncedAt(dbData.records[0].synced_at);
            }
            if (!selectedPoNumber) {
              setSelectedPoNumber(dbData.records[0]["PO #"]);
            }
            setLoading(false);
            return;
          }
        }
      } catch (dbErr) {
        console.warn("[Old PO] MySQL query failed or empty, checking fallback:", dbErr.message);
      }

      // 2. If MySQL was empty, trigger server-side sync from Google Sheets to MySQL
      try {
        setSyncing(true);
        const syncRes = await fetch(`${getBackendUrl()}/api/old-pos/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, spreadsheetId })
        });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          const refetchRes = await fetch(`${getBackendUrl()}/api/old-pos?limit=3500`);
          if (refetchRes.ok) {
            const refData = await refetchRes.json();
            if (refData.records && refData.records.length > 0) {
              setPoMain(refData.records);
              if (refData.records[0]?.synced_at) {
                setSyncedAt(refData.records[0].synced_at);
              }
              if (!selectedPoNumber) {
                setSelectedPoNumber(refData.records[0]["PO #"]);
              }
              setLoading(false);
              setSyncing(false);
              return;
            }
          }
        }
      } catch (syncErr) {
        console.warn("[Old PO] Auto sync failed, falling back to direct sheets API:", syncErr.message);
      } finally {
        setSyncing(false);
      }

      // 3. Fallback: Direct Google Sheets API if server cannot be reached
      const mainRange = "PO_Main!A:Q";
      const itemsRange = "PO_Items!A:I";

      const mainUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(mainRange)}?key=${apiKey}`;
      const mainRes = await fetch(mainUrl);
      if (!mainRes.ok) throw new Error(`Failed to fetch PO metadata: HTTP ${mainRes.status}`);
      const mainData = await mainRes.json();
      const mainRows = mainData.values || [];

      const itemsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(itemsRange)}?key=${apiKey}`;
      const itemsRes = await fetch(itemsUrl);
      if (!itemsRes.ok) throw new Error(`Failed to fetch PO items: HTTP ${itemsRes.status}`);
      const itemsData = await itemsRes.json();
      const itemsRows = itemsData.values || [];

      if (mainRows.length === 0) {
        throw new Error("PO_Main sheet is empty");
      }

      const mainHeaders = mainRows[0].map(h => String(h || "").trim());
      const parsedMain = mainRows.slice(1).map((row) => {
        const item = {};
        mainHeaders.forEach((header, cIdx) => {
          item[header] = row[cIdx] !== undefined ? String(row[cIdx]).trim() : "";
        });
        item["Total Amount"] = parseFloat(item["Total Amount"]) || 0;
        return item;
      }).filter(item => item["PO #"]);

      const itemsHeaders = itemsRows.length > 0 ? itemsRows[0].map(h => String(h || "").trim()) : [];
      const parsedItems = itemsRows.slice(1).map((row) => {
        const item = {};
        itemsHeaders.forEach((header, cIdx) => {
          item[header] = row[cIdx] !== undefined ? String(row[cIdx]).trim() : "";
        });
        item["Qty"] = parseFloat(item["Qty"]) || 0;
        item["Rate"] = parseFloat(item["Rate"]) || 0;
        item["Amount"] = parseFloat(item["Amount"]) || (item["Qty"] * item["Rate"]);
        return item;
      }).filter(item => item["PO #"]);

      setPoMain(parsedMain);
      setPoItems(parsedItems);

      if (parsedMain.length > 0 && !selectedPoNumber) {
        setSelectedPoNumber(parsedMain[0]["PO #"]);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load sheets data.");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  // Manual Trigger: Synchronize live Google Sheets into MySQL Database
  const handleManualSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch(`${getBackendUrl()}/api/old-pos/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, spreadsheetId })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSyncMsg(`✅ Synced ${data.syncedCount || data.totalRecords || 0} POs from Google Sheet into MySQL!`);
      
      // Reload fresh data from MySQL
      const refetch = await fetch(`${getBackendUrl()}/api/old-pos?limit=3500`);
      if (refetch.ok) {
        const refData = await refetch.json();
        if (refData.records) {
          setPoMain(refData.records);
          if (refData.records[0]?.synced_at) {
            setSyncedAt(refData.records[0].synced_at);
          }
        }
      }
      setTimeout(() => setSyncMsg(""), 6000);
    } catch (e) {
      console.error("[Manual Sync Error]:", e);
      alert("Sync failed: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [apiKey, spreadsheetId]);

  // Handle settings update
  const saveSettings = () => {
    setApiKey(tempApiKey);
    setSpreadsheetId(tempSpreadsheetId);
    localStorage.setItem(PO_DASH_KEYS.API_KEY, tempApiKey);
    localStorage.setItem(PO_DASH_KEYS.SPREADSHEET_ID, tempSpreadsheetId);
    setShowSettingsDialog(false);
  };

  // Sync temp values when dialog opens
  useEffect(() => {
    if (showSettingsDialog) {
      setTempApiKey(apiKey);
      setTempSpreadsheetId(spreadsheetId);
    }
  }, [showSettingsDialog, apiKey, spreadsheetId]);

  // Sync pdf option values to localStorage
  useEffect(() => {
    localStorage.setItem(PO_DASH_KEYS.GST_ENABLED, JSON.stringify(gstEnabled));
    localStorage.setItem(PO_DASH_KEYS.GST_PERCENTAGE, gstPercentage.toString());
    localStorage.setItem(PO_DASH_KEYS.SHADE_ENABLED, JSON.stringify(shadeEnabled));
  }, [gstEnabled, gstPercentage, shadeEnabled]);

  // Selected PO full details
  const selectedPO = useMemo(() => {
    if (!selectedPoNumber) return null;
    return poMain.find(po => po["PO #"] === selectedPoNumber) || null;
  }, [poMain, selectedPoNumber]);

  // Line items matching selected PO (reads directly from MySQL items or fallback poItems)
  const selectedPOItems = useMemo(() => {
    if (!selectedPoNumber) return [];
    if (selectedPO && Array.isArray(selectedPO.Items) && selectedPO.Items.length > 0) {
      return selectedPO.Items.map(it => ({
        "PO #": selectedPoNumber,
        "Line #": it.line,
        "Lot #": it["Lot #"] || it.lot_no || selectedPO["Lot No"] || "",
        "lot_no": it.lot_no || it["Lot #"] || selectedPO["Lot No"] || "",
        "Department": it.department || "",
        "Description": it.description || "",
        "Shade": it.shade || "",
        "UOM": it.uom || "PCS",
        "Qty": parseFloat(it.qty) || 0,
        "Rate": parseFloat(it.rate) || 0,
        "Amount": parseFloat(it.amount) || ((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0))
      }));
    }
    return poItems.filter(item => item["PO #"] === selectedPoNumber).map(item => ({
      ...item,
      "Lot #": item["Lot #"] || item.lot_no || selectedPO?.["Lot No"] || "",
      "lot_no": item.lot_no || item["Lot #"] || selectedPO?.["Lot No"] || ""
    }));
  }, [selectedPO, poItems, selectedPoNumber]);

  // Unique suppliers list for filter dropdown
  const uniqueSuppliers = useMemo(() => {
    const suppliers = new Set(poMain.map(po => po["Supplier"]).filter(Boolean));
    return ["ALL", ...Array.from(suppliers).sort()];
  }, [poMain]);

  // Filtered PO records for list pane
  const filteredPOs = useMemo(() => {
    return poMain.filter(po => {
      const poNo = String(po["PO #"] || "").toLowerCase();
      const supplier = String(po["Supplier"] || "").toLowerCase();
      const lotNo = String(po["Lot No"] || po.lot_no || "").toLowerCase();
      const status = String(po["Status"] || "").toUpperCase();

      // Search Query filter (matches PO Number, Supplier, or Lot Number)
      const q = searchQuery.toLowerCase();
      const matchesSearch = poNo.includes(q) ||
        supplier.includes(q) ||
        lotNo.includes(q);

      // Status Tab filter
      const matchesStatus = statusFilter === "ALL" || status === statusFilter;

      // Supplier Dropdown filter
      const matchesSupplier = supplierFilter === "ALL" || po["Supplier"] === supplierFilter;

      // Lot Number Filter
      const hasLot = Boolean(po["Lot No"] && po["Lot No"] !== "N/A");
      const matchesLot = lotFilter === "ALL" ||
        (lotFilter === "WITH_LOT" && hasLot) ||
        (lotFilter === "WITHOUT_LOT" && !hasLot);

      return matchesSearch && matchesStatus && matchesSupplier && matchesLot;
    });
  }, [poMain, searchQuery, statusFilter, supplierFilter, lotFilter]);

  // Dashboard Stats Calculations
  const stats = useMemo(() => {
    const total = poMain.length;
    const spend = poMain.reduce((sum, po) => sum + (parseFloat(po["Total Amount"]) || 0), 0);
    const approved = poMain.filter(po => ["APPROVED", "COMPLETED", "RECEIVED"].includes(String(po["Status"]).toUpperCase())).length;
    const pending = poMain.filter(po => ["PENDING", "ACTIVE", "DRAFT", "ISSUED"].includes(String(po["Status"]).toUpperCase())).length;
    const withLot = poMain.filter(po => Boolean(po["Lot No"] && po["Lot No"] !== "N/A")).length;
    return { total, spend, approved, pending, withLot };
  }, [poMain]);

  // PDF Regeneration Trigger
  const handleRegeneratePdf = async () => {
    if (!selectedPO) return;
    setGeneratingPdf(true);
    try {
      const poNo = selectedPO["PO #"];

      // Constants match defaults from form
      const WEB_APP_BASE = import.meta.env.VITE_GOOGLE_RGP_WEB_APP_URL || "";
      const company = {
        name: "StitchPro Pvt. Ltd.",
        address: "Plot 42, Industrial Area, Jaipur, RJ",
        gstin: "08AABCS1234F1Z2",
        phone: "+91 98765 43210",
        email: "accounts@stitchpro.example",
      };

      // Construct URLs and QR images
      const supervisorName = selectedPO["Supervisor"] || selectedPO["REQUISITION RAISED BY"] || "";
      const { gateUrl, recvUrl } = buildPoQrUrls({
        base: WEB_APP_BASE,
        poNo,
        orderDate: selectedPO["Order Date"],
        expectedDate: selectedPO["Expected Date"],
        supervisorName,
      });

      let gateQR = null;
      let recvQR = null;

      try {
        const qrResults = await Promise.all([
          toDataURL_QR(gateUrl, 320),
          toDataURL_QR(recvUrl, 320)
        ]);
        gateQR = qrResults[0];
        recvQR = qrResults[1];
      } catch (qrErr) {
        console.warn("Failed to generate QR codes:", qrErr);
      }

      // Reconstruct payload totals structure
      const subtotal = selectedPOItems.reduce((sum, item) => sum + (parseFloat(item["Amount"]) || 0), 0);
      const calculatedGst = gstEnabled ? (subtotal * gstPercentage) / 100 : 0;
      const grandTotal = subtotal + calculatedGst;

      const payload = {
        meta: {
          poNumber: poNo,
          lotNo: selectedPO["Lot No"] || selectedPO.lot_no || "",
          orderDate: selectedPO["Order Date"] || null,
          orderTime: selectedPO["Order Time"] || null,
          expectedDate: selectedPO["Expected Date"] || null,
          expectedTime: selectedPO["Expected Time"] || null,
          leadTimeMs: parseFloat(selectedPO["Lead Time (ms)"]) || null,
          leadTimeHuman: selectedPO["Lead Time (human)"] || null,
          requisitionRaisedBy: selectedPO["REQUISITION RAISED BY"] || null,
          preparedBy: selectedPO["Supervisor"] || null,
          approvedBy: selectedPO["AUTHORIZED BY"] || null,
          remarks: selectedPO["Remarks"] || "",
          createdAt: selectedPO["Created At"] || new Date().toISOString(),
          shadeEnabled,
          gstEnabled,
          gstPercentage: gstEnabled ? gstPercentage : 0
        },
        company,
        supplierName: selectedPO["Supplier"] || "N/A",
        rows: selectedPOItems.map((item, idx) => ({
          line: parseInt(item["Line #"]) || idx + 1,
          lotNo: item["Lot #"] || item.lot_no || selectedPO["Lot No"] || "",
          department: item["Department"] || "",
          description: item["Description"] || "",
          shade: item["Shade"] || "",
          uom: item["UOM"] || "PCS",
          qty: parseFloat(item["Qty"]) || 0,
          rate: parseFloat(item["Rate"]) || 0,
          amount: parseFloat(item["Amount"]) || 0
        })),
        totals: {
          sub: subtotal,
          discountTotal: 0,
          taxTotal: 0,
          gstAmount: calculatedGst,
          gstPercentage: gstEnabled ? gstPercentage : 0,
          gross: subtotal,
          payable: grandTotal,
          grandTotal: grandTotal,
          roundAdj: 0
        }
      };

      const doc = generatePurchaseOrderPDF({
        payload,
        options: {
          qrGateImage: gateQR,
          qrRecvImage: recvQR,
          qrSide: 96,
          shadeEnabled,
          gstEnabled,
          gstPercentage: gstEnabled ? gstPercentage : 0
        }
      });

      downloadPdfBlob(doc, `${poNo}.pdf`);
    } catch (e) {
      console.error(e);
      alert(`Could not regenerate PDF:\n${e.message || String(e)}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const getBadgeClass = (status) => {
    if (!status) return "";
    const s = String(status).toUpperCase();
    if (["APPROVED", "COMPLETED", "RECEIVED"].includes(s)) return "status-approved";
    if (["PENDING", "ACTIVE", "ISSUED"].includes(s)) return "status-pending";
    if (s === "DRAFT") return "status-draft";
    return "status-cancelled";
  };

  return (
    <div className="po-dash-container" id="po-dash-root">
      {/* Global Error Banner */}
      {error && (
        <div className="po-dash-error-card" id="po-dash-error">
          <span role="img" aria-label="Error icon">⚠️</span>
          <span>{error}</span>
          <button
            onClick={fetchData}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "inherit",
              textDecoration: "underline",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Quick analytics counters */}
      <section className="po-dash-stats-grid" id="po-dash-stats">
        <div className="po-dash-stat-card">
          <div className="po-dash-stat-icon-wrapper">📦</div>
          <div className="po-dash-stat-info">
            <span className="po-dash-stat-label">Total POs</span>
            <span className="po-dash-stat-value">{stats.total}</span>
          </div>
        </div>
        <div className="po-dash-stat-card stat-info">
          <div className="po-dash-stat-icon-wrapper">₹</div>
          <div className="po-dash-stat-info">
            <span className="po-dash-stat-label">Total Amount</span>
            <span className="po-dash-stat-value">
              {stats.spend.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0
              })}
            </span>
          </div>
        </div>
        <div className="po-dash-stat-card stat-success">
          <div className="po-dash-stat-icon-wrapper">✅</div>
          <div className="po-dash-stat-info">
            <span className="po-dash-stat-label">Approved / Received</span>
            <span className="po-dash-stat-value">{stats.approved}</span>
          </div>
        </div>
        <div className="po-dash-stat-card stat-warning">
          <div className="po-dash-stat-icon-wrapper">⏳</div>
          <div className="po-dash-stat-info">
            <span className="po-dash-stat-label">Pending / Draft</span>
            <span className="po-dash-stat-value">{stats.pending}</span>
          </div>
        </div>
        <div
          className={`po-dash-stat-card stat-lot ${lotFilter === "WITH_LOT" ? "active-filter" : ""}`}
          onClick={() => setLotFilter(prev => prev === "WITH_LOT" ? "ALL" : "WITH_LOT")}
          style={{ cursor: "pointer" }}
          title="Click to filter POs with Lot Numbers"
        >
          <div className="po-dash-stat-icon-wrapper">🏷️</div>
          <div className="po-dash-stat-info">
            <span className="po-dash-stat-label">With Lot No</span>
            <span className="po-dash-stat-value" style={{ color: "#15803d" }}>{stats.withLot}</span>
          </div>
        </div>
      </section>

      {/* Main interactive area */}
      <div className="po-dash-split-layout">
        {/* Left Pane: PO Search & List */}
        <aside className="po-dash-list-pane">
          <div className="po-dash-pane-header">
            <div className="po-dash-pane-title-row">
              <div>
                <h2 className="po-dash-pane-title">
                  <span>📂</span> Standard Purchase Orders ({filteredPOs.length})
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ⚡ MySQL Engine
                  </span>
                  {syncedAt && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                      • Synced {new Date(syncedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={handleManualSync}
                  disabled={syncing || loading}
                  className="po-dash-config-toggle"
                  style={{
                    width: 'auto',
                    padding: '0 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: syncing ? '#e2e8f0' : 'rgba(99, 102, 241, 0.08)',
                    color: '#4f46e5',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    cursor: syncing ? 'not-allowed' : 'pointer'
                  }}
                  title="Sync live records from Google Sheet into MySQL"
                >
                  <span className={syncing ? "spin-animation" : ""}>🔄</span>
                  {syncing ? "Syncing..." : "Sync Sheet"}
                </button>
                <button
                  onClick={() => setShowSettingsDialog(true)}
                  className="po-dash-config-toggle"
                  title="Configure Sheets Integration"
                >
                  ⚙️
                </button>
              </div>
            </div>

            {/* Sync Notification Banner */}
            {syncMsg && (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #6ee7b7',
                color: '#065f46',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {syncMsg}
              </div>
            )}

            {/* Search Bar */}
            <div className="po-dash-search-box">
              <span className="po-dash-search-icon">🔍</span>
              <input
                type="text"
                className="po-dash-search-input"
                placeholder="Search by PO # or Supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filters dropdown and tabs */}
            <div className="po-dash-filter-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="po-dash-filter-select"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="COMPLETED">Completed</option>
                <option value="RECEIVED">Received</option>
              </select>

              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="po-dash-filter-select"
              >
                {uniqueSuppliers.map(sup => (
                  <option key={sup} value={sup}>{sup === "ALL" ? "All Suppliers" : sup}</option>
                ))}
              </select>

              <select
                value={lotFilter}
                onChange={(e) => setLotFilter(e.target.value)}
                className="po-dash-filter-select"
              >
                <option value="ALL">All PO Types</option>
                <option value="WITH_LOT">🏷️ Lot POs Only</option>
                <option value="WITHOUT_LOT">📦 General POs Only</option>
              </select>
            </div>
          </div>

          {/* List scroll */}
          <div className="po-dash-list-scroll">
            {loading ? (
              <div className="po-dash-loading-wrapper">
                <div className="po-dash-spinner"></div>
                <div className="po-dash-loading-text">Fetching PO records from Google Sheets...</div>
              </div>
            ) : filteredPOs.length === 0 ? (
              <div className="po-dash-empty-list">
                <div className="po-dash-empty-icon">📂</div>
                <div>No Purchase Orders match your filters.</div>
              </div>
            ) : (
              filteredPOs.map((po, index) => {
                const poNo = po["PO #"];
                const isActive = poNo === selectedPoNumber;
                const amt = po["Total Amount"];
                const dateStr = po["Order Date"] || po["Created At"] || "";
                return (
                  <div
                    key={poNo || index}
                    onClick={() => setSelectedPoNumber(poNo)}
                    className={`po-dash-record-card ${isActive ? "active" : ""}`}
                  >
                    <div className="po-dash-card-header">
                      <span className="po-dash-card-po-no">{poNo}</span>
                      <span className={`po-dash-status-badge ${getBadgeClass(po["Status"])}`}>
                        {po["Status"] || "Draft"}
                      </span>
                    </div>
                    <div className="po-dash-card-supplier">
                      {po["Supplier"] || "Unknown Supplier"}
                    </div>
                    <div className="po-dash-card-lot">
                      {po["Lot No"] && po["Lot No"] !== "N/A" ? (
                        <span className="po-dash-lot-badge" title={`Original Lot Number: ${po["Lot No"]}`}>
                          🏷️ Lot: {po["Lot No"]}
                        </span>
                      ) : (
                        <span className="po-dash-lot-badge-general" title="General Factory PO">
                          📦 General PO
                        </span>
                      )}
                    </div>
                    <div className="po-dash-card-details">
                      <span>{dateStr.split("T")[0]}</span>
                      <span className="po-dash-card-amount">
                        {amt > 0 ? `₹${amt.toLocaleString("en-IN")}` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Pane: Selected PO Details */}
        <section className="po-dash-detail-pane">
          {!selectedPO ? (
            <div className="po-dash-detail-empty-state">
              <span className="po-dash-detail-empty-icon" role="img" aria-label="Folder icon">📁</span>
              <h3 className="po-dash-detail-empty-title">No Purchase Order Selected</h3>
              <p className="po-dash-detail-empty-desc">
                Select a purchase order from the list on the left to inspect its details and download copies.
              </p>
            </div>
          ) : (
            <>
              {/* Header detail row */}
              <div className="po-dash-detail-header">
                <div className="po-dash-detail-header-top">
                  <div className="po-dash-detail-title-wrapper">
                    <h1 className="po-dash-detail-title">{selectedPO["PO #"]}</h1>
                    <span className={`po-dash-status-badge ${getBadgeClass(selectedPO["Status"])}`}>
                      {selectedPO["Status"] || "Draft"}
                    </span>
                  </div>

                  <div className="po-dash-actions-row">
                    <button
                      onClick={handleRegeneratePdf}
                      disabled={generatingPdf || selectedPOItems.length === 0}
                      className="po-dash-action-btn"
                      id="po-regenerate-pdf-btn"
                    >
                      {generatingPdf ? (
                        <>⌛ Rebuilding PDF...</>
                      ) : (
                        <>🖨️ Re-Download PO PDF</>
                      )}
                    </button>
                  </div>
                </div>

                <div className="po-dash-detail-info-grid">
                  <div className="po-dash-info-block">
                    <span className="po-dash-info-label">Supplier</span>
                    <span className="po-dash-info-value">{selectedPO["Supplier"] || "N/A"}</span>
                  </div>
                  <div className="po-dash-info-block">
                    <span className="po-dash-info-label">Supervisor</span>
                    <span className="po-dash-info-value">{selectedPO["Supervisor"] || "N/A"}</span>
                  </div>
                  <div className="po-dash-info-block po-dash-info-lot-block">
                    <span className="po-dash-info-label">Original Lot No</span>
                    {selectedPO["Lot No"] && selectedPO["Lot No"] !== "N/A" ? (
                      <span className="po-dash-info-value lot-number-highlight">
                        🏷️ Lot {selectedPO["Lot No"]}
                      </span>
                    ) : (
                      <span className="po-dash-info-value lot-number-general">
                        General PO (No Lot)
                      </span>
                    )}
                  </div>
                  <div className="po-dash-info-block">
                    <span className="po-dash-info-label">Total Amount</span>
                    <span className="po-dash-info-value">
                      {selectedPO["Total Amount"] > 0
                        ? `₹${selectedPO["Total Amount"].toLocaleString("en-IN")}`
                        : `₹${selectedPOItems.reduce((sum, i) => sum + (parseFloat(i["Amount"]) || 0), 0).toLocaleString("en-IN")}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail Information scrollable body */}
              <div className="po-dash-detail-scroll">
                {/* Local PDF generation control options */}
                <div className="po-dash-meta-section" style={{ gridTemplateColumns: "1fr", marginBottom: "4px" }}>
                  <div className="po-dash-detail-card" style={{ flexDirection: "row", flexWrap: "wrap", gap: "24px", alignItems: "center" }}>
                    <span className="po-dash-info-label" style={{ border: "none", padding: 0, margin: 0 }}>PDF Options:</span>

                    <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={gstEnabled}
                        onChange={(e) => setGstEnabled(e.target.checked)}
                        style={{ cursor: "pointer" }}
                      />
                      Include GST
                    </label>

                    {gstEnabled && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", color: "var(--text-muted, #64748b)" }}>GST %:</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={gstPercentage}
                          onChange={(e) => setGstPercentage(parseFloat(e.target.value) || 0)}
                          style={{ width: "60px", padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "4px", outline: "none" }}
                        />
                      </div>
                    )}

                    <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={shadeEnabled}
                        onChange={(e) => setShadeEnabled(e.target.checked)}
                        style={{ cursor: "pointer" }}
                      />
                      Include Shade Column
                    </label>
                  </div>
                </div>

                <div className="po-dash-meta-section">
                  {/* Time details card */}
                  <div className="po-dash-detail-card">
                    <h3 className="po-dash-card-title">Order Timeline</h3>
                    <div className="po-dash-kv-list">
                      <div className="po-dash-kv-row">
                        <span className="po-dash-key">Order Date & Time</span>
                        <span className="po-dash-value">
                          {[selectedPO["Order Date"], selectedPO["Order Time"]].filter(Boolean).join(" ")}
                        </span>
                      </div>
                      <div className="po-dash-kv-row">
                        <span className="po-dash-key">Expected Date & Time</span>
                        <span className="po-dash-value">
                          {[selectedPO["Expected Date"], selectedPO["Expected Time"]].filter(Boolean).join(" ")}
                        </span>
                      </div>
                      <div className="po-dash-kv-row">
                        <span className="po-dash-key">Lead Time</span>
                        <span className="po-dash-value">{selectedPO["Lead Time (human)"] || "—"}</span>
                      </div>
                      <div className="po-dash-kv-row">
                        <span className="po-dash-key">Created At</span>
                        <span className="po-dash-value">{selectedPO["Created At"] ? new Date(selectedPO["Created At"]).toLocaleString() : "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metadata attributes card */}
                  <div className="po-dash-detail-card">
                    <h3 className="po-dash-title">Approval Signatures</h3>
                    <div className="po-dash-kv-list">
                      <div className="po-dash-kv-row">
                        <span className="po-dash-key">Requisition Raised By</span>
                        <span className="po-dash-value">{selectedPO["REQUISITION RAISED BY"] || "—"}</span>
                      </div>
                      <div className="po-dash-kv-row">
                        <span className="po-dash-key">Authorized By</span>
                        <span className="po-dash-value">{selectedPO["AUTHORIZED BY"] || "—"}</span>
                      </div>
                      <div className="po-dash-kv-row">
                        <span className="po-dash-key">Gate In Timestamp</span>
                        <span className="po-dash-value">{selectedPO["Gate In At"] || "Not Gate In Yet"}</span>
                      </div>
                      <div className="po-dash-kv-row">
                        <span className="po-dash-key">Received Timestamp</span>
                        <span className="po-dash-value">{selectedPO["Received At"] || "Not Received Yet"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Line Items section */}
                <div className="po-dash-items-section">
                  <h3 className="po-dash-items-title">PO Line Items ({selectedPOItems.length})</h3>
                  <div className="po-dash-table-wrapper">
                    <table className="po-dash-table">
                      <thead>
                        <tr>
                          <th className="align-center">Line #</th>
                          <th className="align-center">Lot #</th>
                          <th>Department</th>
                          <th>Description</th>
                          {shadeEnabled && <th>Shade</th>}
                          <th className="align-center">UOM</th>
                          <th className="align-right">Qty</th>
                          <th className="align-right">Rate</th>
                          <th className="align-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPOItems.map((item, idx) => {
                          const itemLot = item["Lot #"] || item.lot_no || selectedPO["Lot No"] || "";
                          return (
                            <tr key={item["Line #"] || idx}>
                              <td className="align-center">{item["Line #"] || (idx + 1)}</td>
                              <td className="align-center">
                                <span className={`po-dash-item-lot-tag ${itemLot ? "has-lot" : ""}`}>
                                  {itemLot || "—"}
                                </span>
                              </td>
                              <td>{item["Department"]}</td>
                              <td>{item["Description"]}</td>
                              {shadeEnabled && <td>{item["Shade"] || "—"}</td>}
                              <td className="align-center">{item["UOM"]}</td>
                              <td className="align-right">{parseFloat(item["Qty"] || 0).toLocaleString()}</td>
                              <td className="align-right">₹{parseFloat(item["Rate"] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="align-right">₹{parseFloat(item["Amount"] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })}

                        {/* Totals row */}
                        <tr className="po-dash-table-total-row">
                          <td colSpan={shadeEnabled ? 6 : 5} className="align-right" style={{ fontWeight: 700 }}>Total Items Value:</td>
                          <td className="align-right" style={{ fontWeight: 700 }}>
                            {selectedPOItems.reduce((sum, item) => sum + (parseFloat(item["Qty"]) || 0), 0).toLocaleString()}
                          </td>
                          <td></td>
                          <td className="align-right" style={{ fontWeight: 700 }}>
                            ₹{selectedPOItems.reduce((sum, item) => sum + (parseFloat(item["Amount"]) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </>
          )}
        </section>
      </div>

      {/* Sheets Config Dialog */}
      {showSettingsDialog && (
        <div className="po-dash-dialog-overlay" id="po-settings-overlay">
          <div className="po-dash-dialog">
            <div className="po-dash-dialog-header">
              <h3 className="po-dash-dialog-title">Configure Spreadsheet Integration</h3>
              <button onClick={() => setShowSettingsDialog(false)} className="po-dash-dialog-close">
                ×
              </button>
            </div>
            <div className="po-dash-dialog-body">
              <div className="po-dash-form-group">
                <label className="po-dash-form-label">Google Sheet Spreadsheet ID</label>
                <input
                  type="text"
                  value={tempSpreadsheetId}
                  onChange={(e) => setTempSpreadsheetId(e.target.value)}
                  className="po-dash-form-input"
                  placeholder="Enter spreadsheet ID..."
                />
              </div>
              <div className="po-dash-form-group">
                <label className="po-dash-form-label">Google API Key</label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="po-dash-form-input"
                  placeholder="Enter API key..."
                />
              </div>
            </div>
            <div className="po-dash-dialog-footer">
              <button onClick={() => setShowSettingsDialog(false)} className="po-dash-btn-secondary">
                Cancel
              </button>
              <button onClick={saveSettings} className="po-dash-btn-primary">
                Save & Load
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
