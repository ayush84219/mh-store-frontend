import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText, PlusCircle, Trash2, Download, RefreshCw,
  CheckCircle, AlertTriangle, Play, Settings, X, Search,
  Briefcase, Truck, Award, UserCheck, Shield, ChevronDown, History,
  ChevronLeft, ChevronRight, Layers, Check
} from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

// ─── Reusable Pagination Bar ──────────────────────────────────────────────────
const PaginationBar = ({ page, setPage, rpp, setRpp, totalItems, rppOptions = [5, 10, 20, 50, 100] }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / rpp));
  const cur = Math.min(page, totalPages - 1);
  const start = totalItems === 0 ? 0 : cur * rpp + 1;
  const end = Math.min(totalItems, (cur + 1) * rpp);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderTop: '1.5px solid var(--border-color)',
      backgroundColor: 'var(--bg-secondary)',
      flexWrap: 'wrap',
      gap: '10px',
      fontSize: '12.5px',
      color: 'var(--text-muted)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>Showing <strong style={{ color: 'var(--text-main)' }}>{start}–{end}</strong> of <strong style={{ color: 'var(--text-main)' }}>{totalItems}</strong> PO records</span>
        <span style={{ color: 'var(--border-color)' }}>|</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>Rows:</span>
          <select
            value={rpp}
            onChange={(e) => {
              setRpp(Number(e.target.value));
              setPage(0);
            }}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-main)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {rppOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={cur === 0}
          onClick={() => setPage(p => Math.max(0, p - 1))}
          style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px', opacity: cur === 0 ? 0.45 : 1, cursor: cur === 0 ? 'not-allowed' : 'pointer' }}
        >
          <ChevronLeft size={13} />
          <span>Prev</span>
        </button>

        <span style={{ padding: '3px 10px', fontWeight: '700', color: 'var(--accent-color)', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11.5px' }}>
          Page {cur + 1} / {totalPages}
        </span>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={cur >= totalPages - 1}
          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px', opacity: cur >= totalPages - 1 ? 0.45 : 1, cursor: cur >= totalPages - 1 ? 'not-allowed' : 'pointer' }}
        >
          <span>Next</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
};

/** =========================
 * CONFIG
 * ========================= */
const WEB_APP_BASE = "";
const SHEET_ID = "13ArpFOD7idmpv7QIRJQkD-tfswtkH6rNnEANtv2M7Ek";
const RANGE_A1 = "Index!A:C";
const API_KEY = "";
const PO_DATA_RANGE = "PO_Items!A:I";

/** =========================
 * Local Storage Keys
 * ========================= */
const LOCAL_STORAGE_KEYS = {
  SHADE_ENABLED: "po_shade_enabled",
  DESCRIPTIONS: "po_descriptions",
  SHADES: "po_shades",
  GST_ENABLED: "po_gst_enabled",
  GST_PERCENTAGE: "po_gst_percentage",
  LAST_PO_NUMBER: "po_last_number",
  REQUISITION_NAMES: "po_requisition_names",
  PREPARED_NAMES: "po_prepared_names",
  APPROVED_NAMES: "po_approved_names",
};

const DEFAULT_REQUISITION_NAMES = ["JAYBIR", "NITIN KHANNA", "SONU MASTER JI", "EA"];
const DEFAULT_PREPARED_NAMES = ["RASHMI"];
const DEFAULT_APPROVED_NAMES = ["SAHIL SIR", "EA", "MOHIT GOYAL"];

const UOM_OPTIONS = [
  "PCS", "SET", "PAIR", "DOZEN", "GROSS", "NOS", "UNIT",
  "MG", "GRAM", "KG", "QUINTAL", "TON",
  "MM", "CM", "MTR", "INCH", "FEET", "YARD", "KM",
  "SQMM", "SQCM", "SQM", "SQFT", "SQYD", "SFT",
  "ML", "LTR", "KL", "CC", "CUM",
  "ROLL", "BUNDLE", "BOX", "PACK", "BAG", "SACK", "CARTON", "PALLET",
  "MTRS", "KGS", "CONES", "HANK", "BALE",
  "SEC", "MIN", "HOUR", "DAY", "WEEK", "MONTH",
  "JOB", "SHIFT", "LOT", "ORDER", "LOAD"
];

/** =========================
 * Utilities
 * ========================= */
const fmtMoney = (n) =>
  (Number.isFinite(+n) ? +n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function generateNextPoNumber(existingPoNumbers) {
  const parsedNumbers = [];
  if (Array.isArray(existingPoNumbers)) {
    existingPoNumbers.forEach(poStr => {
      if (poStr) {
        const match = poStr.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          // Only consider numbers in the 11xxx series range
          if (num >= 11000 && num < 20000) {
            parsedNumbers.push(num);
          }
        }
      }
    });
  }

  if (parsedNumbers.length === 0) {
    return 'PO-11001';
  }

  const maxNum = Math.max(...parsedNumbers);
  return `PO-${maxNum + 1}`;
}

const blankRow = () => ({
  department: "",
  description: "",
  shade: "",
  uom: "",
  qty: 0,
  rate: 0
});

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const toDate = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const [h, m] = (timeStr || "00:00").split(":").map((x) => parseInt(x || "0", 10));
  const [Y, M, D] = dateStr.split("-").map((x) => parseInt(x, 10));
  return new Date(Y, (M || 1) - 1, D || 1, h || 0, m || 0, 0);
};

const humanDuration = (ms) => {
  if (ms == null) return "";
  const sign = ms < 0 ? -1 : 1;
  ms = Math.abs(ms);
  const hours = Math.floor(ms / 36e5);
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  const mins = Math.floor((ms % 36e5) / 60000);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (remH) parts.push(`${remH}h`);
  if (!days && !remH) parts.push(`${mins}m`);
  const txt = parts.join(" ");
  return sign < 0 ? `-${txt}` : txt;
};

async function fetchSheetRows(sheetId, rangeA1, apiKey) {
  if (!sheetId || !apiKey) return [];
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(rangeA1)}?key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Sheets API error: ${resp.status}`);
  const data = await resp.json();
  const values = data.values || [];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const [dept = "", item = "", rate = ""] = values[i] || [];
    const numRate = Number(rate) || 0;
    if (dept || item) rows.push({ dept: String(dept).trim(), item: String(item).trim(), rate: numRate });
  }
  return rows;
}

async function fetchPODataByNumber(poNumber, sheetId, apiKey) {
  if (!sheetId || !apiKey) throw new Error("Google Sheets configurations are not set.");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(PO_DATA_RANGE)}?key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Sheets API error: ${resp.status}`);
  const data = await resp.json();
  const values = data.values || [];
  if (values.length < 2) throw new Error("No data found in PO sheet");

  const headers = values[0];
  const poNumberColIndex = headers.findIndex(h => h?.toLowerCase().includes("po") || h?.toLowerCase().includes("po number") || h === "PO #");
  const lineColIndex = headers.findIndex(h => h?.toLowerCase().includes("line") || h?.toLowerCase().includes("line #"));
  const deptColIndex = headers.findIndex(h => h?.toLowerCase().includes("department") || h?.toLowerCase().includes("dept"));
  const descColIndex = headers.findIndex(h => h?.toLowerCase().includes("description") || h?.toLowerCase().includes("item"));
  const uomColIndex = headers.findIndex(h => h?.toLowerCase().includes("uom") || h?.toLowerCase().includes("unit"));
  const qtyColIndex = headers.findIndex(h => h?.toLowerCase().includes("qty") || h?.toLowerCase().includes("quantity"));
  const rateColIndex = headers.findIndex(h => h?.toLowerCase().includes("rate") || h?.toLowerCase().includes("price"));

  const matchingRows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[poNumberColIndex]).trim() === String(poNumber).trim()) {
      matchingRows.push({
        line: row[lineColIndex] || i,
        department: row[deptColIndex] || "",
        description: row[descColIndex] || "",
        uom: row[uomColIndex] || "",
        qty: parseFloat(row[qtyColIndex]) || 0,
        rate: parseFloat(row[rateColIndex]) || 0,
      });
    }
  }

  if (matchingRows.length === 0) throw new Error(`No data found for PO number: ${poNumber}`);
  return matchingRows;
}

async function fetchAllPONumbers(sheetId, apiKey) {
  if (!sheetId || !apiKey) return [];
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(PO_DATA_RANGE)}?key=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Sheets API error: ${resp.status}`);
    const data = await resp.json();
    const values = data.values || [];
    if (values.length < 2) return [];

    const headers = values[0];
    const poNumberColIndex = headers.findIndex(h => h?.toLowerCase().includes("po") || h?.toLowerCase().includes("po number") || h === "PO #");
    if (poNumberColIndex === -1) return [];

    const poNumbers = new Set();
    for (let i = 1; i < values.length; i++) {
      const poNumber = values[i][poNumberColIndex];
      if (poNumber && poNumber.trim()) {
        poNumbers.add(poNumber.trim());
      }
    }
    return Array.from(poNumbers).sort().reverse();
  } catch (error) {
    console.error("Error fetching PO numbers:", error);
    return [];
  }
}

export async function resolveLocalSystemUrl() {
  const hostname = window.location.hostname;

  // Check if we are browsing via a local host address
  const isLocalHostOrIP =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.');

  if (!isLocalHostOrIP) {
    // We are on a public domain/tunnelling address (e.g. ngrok, public domain), use origin directly
    return `${window.location.origin}/`;
  }

  let serverIp = hostname;
  try {
    const res = await fetch(`${getBackendUrl()}/api/public/server-ip`);
    if (res.ok) {
      const data = await res.json();
      if (data.ip) {
        serverIp = data.ip;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch server IP, falling back to hostname:", err);
  }
  const port = window.location.port ? `:${window.location.port}` : '';
  return `http://${serverIp}${port}/`;
}

export function buildPoQrUrls({ base, poNo, orderDate, expectedDate, supervisorName }) {
  const enc = encodeURIComponent;
  const who = supervisorName ? `&who=${enc(supervisorName)}` : "";
  const resolvedBase = base && (base.includes("/exec") || base.startsWith("http")) ? base : `${window.location.origin}/`;
  const gateUrl = `${resolvedBase}?action=gate&po=${enc(poNo)}&date=${enc(orderDate || "")}${who}`;
  const recvUrl = `${resolvedBase}?action=receive&po=${enc(poNo)}&rdate=${enc(expectedDate || "")}${who}`;
  return { gateUrl, recvUrl };
}

export async function toDataURL_QR(qrText, size = 320) {
  try {
    return await QRCode.toDataURL(qrText, { width: size, margin: 1 });
  } catch (err) {
    console.error("Failed to generate local QR:", err);
    return null;
  }
}

function getLocalStorageItem(key, defaultValue) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    return defaultValue;
  }
}

function setLocalStorageItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving ${key} to localStorage:`, e);
  }
}

/** =========================
 * Save autocomplete debouncers
 * ========================= */
// Autocomplete savers will be defined inside Component scope for state interaction.

function saveNameToLocalStorage(key, name) {
  if (!name || !name.trim()) return;
  const trimmedName = name.trim();
  if (trimmedName.length < 2) return;
  const savedNames = getLocalStorageItem(key, []);
  if (!savedNames.includes(trimmedName)) {
    const updatedNames = [trimmedName, ...savedNames.filter(n => n !== trimmedName)];
    setLocalStorageItem(key, updatedNames.slice(0, 50));
  }
}

/** =========================
 * PDF Generation function
 * ========================= */
export function generatePurchaseOrderPDF({ payload, options = {} }) {
  const {
    qrGateImage = null,
    qrRecvImage = null,
    qrSide = 96,
    shadeEnabled = false,
    gstEnabled = false,
    gstPercentage = 0
  } = options;

  const doc = new jsPDF({ unit: "pt", format: "a3" });

  const drawPODocument = (rowsWithValues, isSupplierCopy = false) => {
    doc.setFont("helvetica", "normal");
    doc.setLineWidth(0.8);

    const page = {
      w: doc.internal.pageSize.getWidth(),
      h: doc.internal.pageSize.getHeight(),
      m: 48,
      gap: 12
    };

    const setSize = (s) => doc.setFontSize(s);
    const bold = () => doc.setFont(undefined, "bold");
    const normal = () => doc.setFont(undefined, "normal");
    const text = (t, x, y, opt = {}) => doc.text(String(t ?? ""), x, y, opt);
    const rtext = (t, x, y, opt = {}) => text(t, x, y, { align: "right", ...opt });
    const ctext = (t, x, y, opt = {}) => text(t, x, y, { align: "center", ...opt });
    const line = (x1, y1, x2, y2) => {
      doc.setDrawColor(0, 0, 0);
      doc.line(x1, y1, x2, y2);
    };
    const wrap = (str, w) => doc.splitTextToSize(String(str || ""), w);
    const money = (n) =>
      (Number.isFinite(+n) ? +n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const roundRect = (x, y, w, h, r = 7, style = "S") => {
      doc.setDrawColor(0, 0, 0);
      if (doc.roundedRect) {
        return doc.roundedRect(x, y, w, h, r, r, style);
      } else {
        return doc.rect(x, y, w, h, style);
      }
    };
    const drawRect = (x, y, w, h, style = "S") => {
      doc.setDrawColor(0, 0, 0);
      doc.rect(x, y, w, h, style);
    };

    const SIG_H = 92;
    const QR_TITLE_H = 18;
    const QR_SIDE = qrSide || 96;
    const BOTTOM_QR_H = QR_TITLE_H + 8 + QR_SIDE + 10;
    const FOOTER_HEIGHT = BOTTOM_QR_H + 12 + SIG_H + 8;
    const FOOTER_START_Y = page.h - page.m - FOOTER_HEIGHT;
    const CONTENT_MAX_Y = FOOTER_START_Y - 20;

    let y = page.m;

    const needSpaceForContent = (requiredHeight) => {
      if (y + requiredHeight > CONTENT_MAX_Y) {
        drawFooterOnPage();
        doc.addPage();
        doc.setDrawColor(0, 0, 0);
        roundRect(24, 24, page.w - 48, page.h - 48, 8, "S");
        y = page.m;
        drawPageHeader(isSupplierCopy);
        return true;
      }
      return false;
    };

    const drawPageHeader = (isSupplierCopyHeader = false) => {
      setSize(20);
      bold();
      const headerText = isSupplierCopyHeader ? "PURCHASE ORDER (SUPPLIER COPY)" : "PURCHASE ORDER (ORIGINAL)";
      text(headerText, page.w / 2, y, { align: "center" });
      normal();
      line(page.m, y + 6, page.w - page.m, y + 6);
      y += 26;
    };

    const drawFooterOnPage = () => {
      const innerW = page.w - 2 * page.m;
      const colW = (innerW - page.gap * 2) / 3;
      const x1 = page.m, x2 = x1 + colW + page.gap, x3 = x2 + colW + page.gap;

      const sigTop = page.h - page.m - SIG_H;
      const blockTop = sigTop - 12 - BOTTOM_QR_H;

      roundRect(x1, blockTop, colW, BOTTOM_QR_H, 7, "S");
      setSize(10);
      bold(); text("MATERIAL RECEIVED", x1 + 10, blockTop + 14); normal();
      line(x1 + 10, blockTop + 18, x1 + colW - 10, blockTop + 18);
      if (qrRecvImage) {
        const qx = x1 + 10 + (colW - 20 - QR_SIDE) / 2;
        const qy = blockTop + 18 + 10;
        try { doc.addImage(qrRecvImage, "PNG", qx, qy, QR_SIDE, QR_SIDE); } catch { }
      }

      const bigW = colW * 2 + page.gap;
      roundRect(x2, blockTop, bigW, BOTTOM_QR_H, 7, "S");
      setSize(10);
      bold(); ctext("REMARKS", x2 + bigW / 2, blockTop + 14); normal();
      line(x2 + 10, blockTop + 18, x2 + bigW - 10, blockTop + 18);

      if (payload.meta?.remarks && payload.meta.remarks.trim() !== "") {
        const remarksLines = doc.splitTextToSize(payload.meta.remarks, bigW - 60);
        const totalTextHeight = remarksLines.length * 12;
        const boxCenterY = blockTop + BOTTOM_QR_H / 2;
        const textStartY = boxCenterY - totalTextHeight / 2 + 6;
        const minStartY = blockTop + 28;
        const actualStartY = Math.max(textStartY, minStartY);

        let ry = actualStartY;
        remarksLines.forEach(lineText => {
          if (ry < blockTop + BOTTOM_QR_H - 10) {
            ctext(lineText.trim(), x2 + bigW / 2, ry);
            ry += 12;
          }
        });
      } else {
        const boxCenterY = blockTop + BOTTOM_QR_H / 2;
        ctext("No remarks provided", x2 + bigW / 2, boxCenterY, { fontStyle: "italic", opacity: 0.5 });
      }

      const sigColWidth = (innerW - page.gap * 3) / 4;
      const xSig1 = page.m;
      const xSig2 = xSig1 + sigColWidth + page.gap;
      const xSig3 = xSig2 + sigColWidth + page.gap;
      const xSig4 = xSig3 + sigColWidth + page.gap;

      [xSig1, xSig2, xSig3, xSig4].forEach((x) => roundRect(x, sigTop, sigColWidth, SIG_H, 7, "S"));

      bold();
      text("REQUISITION RAISED BY", xSig1 + 10, sigTop + 16);
      text("PREPARED BY", xSig2 + 10, sigTop + 16);
      text("APPROVED BY", xSig3 + 10, sigTop + 16);
      text("SUPPLIER'S", xSig4 + 10, sigTop + 16);
      normal();

      const writeSig = (x, showRequisitionName, showPreparedName, showApprovedName) => {
        const baseY = sigTop + SIG_H - 26;
        text("Signature", x + 10, baseY - 10);
        line(x + 10, baseY - 8, x + sigColWidth - 10, baseY - 8);
        text("Name:", x + 10, baseY + 2);

        if (x === xSig1 && showRequisitionName && payload.meta?.requisitionRaisedBy) {
          text(payload.meta.requisitionRaisedBy, x + 46, baseY + 2);
        } else if (x === xSig2 && showPreparedName && payload.meta?.preparedBy) {
          text(payload.meta.preparedBy, x + 46, baseY + 2);
        } else if (x === xSig3 && showApprovedName && payload.meta?.approvedBy) {
          text(payload.meta.approvedBy, x + 46, baseY + 2);
        }
        text("Date:", x + 10, baseY + 14);
      };

      writeSig(xSig1, true, false, false);
      writeSig(xSig2, false, true, false);
      writeSig(xSig3, false, false, true);
      writeSig(xSig4, false, false, false);
    };

    doc.setDrawColor(0, 0, 0);
    roundRect(24, 24, page.w - 48, page.h - 48, 8, "S");
    drawPageHeader(isSupplierCopy);

    (function drawTopSection() {
      const innerW = page.w - 2 * page.m;
      const rPO = 0.44, rSup = 0.26, rGate = 0.30;
      const wAvail = innerW - page.gap * 2;
      const wPO = Math.floor(wAvail * rPO);
      const wSup = Math.floor(wAvail * rSup);
      const wGate = wAvail - wPO - wSup;

      const x1 = page.m;
      const x2 = x1 + wPO + page.gap;
      const x3 = x2 + wSup + page.gap;

      const metaPad = 12;
      const labelValueGap = 20;

      const mRows = [
        ["PO #", (payload.meta?.poNumber || "").replace(/\s+/g, "")],
        ["Order Date/Time", [payload.meta?.orderDate, payload.meta?.orderTime].filter(Boolean).join(" ")],
        ...(payload.meta?.expectedDate ? [["Expected Date/Time", payload.meta.expectedDate]] : []),
        ...(payload.meta?.leadTimeHuman ? [["Lead Time", payload.meta.leadTimeHuman]] : []),
        ...(payload.meta?.requisitionRaisedBy ? [["Requisition Raised By", payload.meta.requisitionRaisedBy]] : []),
        ...(payload.meta?.preparedBy ? [["Prepared By", payload.meta.preparedBy]] : []),
        ...(payload.meta?.approvedBy ? [["Approved By", payload.meta.approvedBy]] : []),
      ];

      let totalMetaHeight = 22 + 16;
      mRows.forEach(([label, value]) => {
        const labelWidth = doc.getTextWidth(`${label}:`);
        const valueX = metaPad + labelWidth + labelValueGap;
        const maxValueWidth = wPO - valueX - metaPad;
        const valueLines = doc.splitTextToSize(value || "", maxValueWidth);
        totalMetaHeight += 16 + (Math.max(0, valueLines.length - 1) * 16);
      });
      const metaH = totalMetaHeight;

      const supPad = 12;
      const supBodyW = wSup - supPad * 2;
      const supLines = [
        payload.supplierName || "",
        // ...wrap(payload.supplierAddress || "", supBodyW),
        // ...(payload.supplierPhone ? [`Phone: ${payload.supplierPhone}`] : []),
        // ...(payload.supplierEmail ? [`Email: ${payload.supplierEmail}`] : []),
      ];
      const supH = 22 + supLines.filter(Boolean).length * 12 + 16;

      const gateH = QR_TITLE_H + 8 + QR_SIDE + 10;
      const blockH = Math.max(metaH, supH, gateH);

      if (needSpaceForContent(blockH)) return;

      roundRect(x1, y, wPO, blockH, 7, "S");
      setSize(13);
      bold(); text("PO DETAILS", x1 + 12, y + 14); normal();
      line(x1 + 12, y + 18, x1 + wPO - 12, y + 18);

      let my = y + 30;
      mRows.forEach(([label, value]) => {
        const labelX = x1 + metaPad;
        const labelWidth = doc.getTextWidth(`${label}:`);
        const valueX = labelX + labelWidth + labelValueGap;
        const maxValueWidth = wPO - (valueX - x1) - metaPad;
        bold(); text(`${label}:`, labelX, my);
        normal();
        const valueLines = doc.splitTextToSize(value || "", maxValueWidth);
        valueLines.forEach((line, idx) => {
          text(line, valueX, my + (idx * 16));
        });
        my += 16 + (Math.max(0, valueLines.length - 1) * 16);
      });

      roundRect(x2, y, wSup, blockH, 7, "S");
      setSize(13);
      bold(); text("SUPPLIER", x2 + 12, y + 14); normal();
      line(x2 + 12, y + 18, x2 + wSup - 12, y + 18);
      let sy = y + 30;
      supLines.forEach((ln) => { if (ln) { text(ln, x2 + supPad, sy); sy += 12; } });

      roundRect(x3, y, wGate, blockH, 7, "S");
      setSize(12);
      bold(); text("GATE IN — SCAN (FORM)", x3 + 12, y + 14); normal();
      line(x3 + 12, y + 18, x3 + wGate - 12, y + 18);
      if (qrGateImage) {
        const qx = x3 + 12 + (wGate - 24 - QR_SIDE) / 2;
        const qy = y + 18 + 10;
        try { doc.addImage(qrGateImage, "PNG", qx, qy, QR_SIDE, QR_SIDE); } catch { }
      }
      y += blockH + 16;
    })();

    (function drawTable() {
      const x0 = page.m, innerW = page.w - 2 * page.m;
      setSize(13); normal();

      const rows = (rowsWithValues || []).map((r, i) => {
        const qStr = (+r.qty || 0).toLocaleString();
        const rate = isSupplierCopy ? 0 : (+r.rate || 0);
        const amt = (+r.qty || 0) * rate;
        const rateStr = money(rate);
        const amtStr = money(amt);
        return { ...r, _i: i, _qtyStr: qStr, _rateStr: rateStr, _amtStr: amtStr, _rateValue: rate };
      });

      let totalSum = rows.reduce((sum, r) => sum + ((+r.qty || 0) * r._rateValue), 0);
      const gstAmount = gstEnabled && !isSupplierCopy ? (totalSum * gstPercentage) / 100 : 0;

      let cols;
      if (shadeEnabled) {
        cols = [
          { key: "line", title: "#", pct: 0.05, align: "right" },
          { key: "department", title: "DEPARTMENT", pct: 0.15 },
          { key: "description", title: "DESCRIPTION", pct: 0.30 },
          { key: "shade", title: "SHADE", pct: 0.15 },
          { key: "uom", title: "UOM", pct: 0.08, align: "center" },
          { key: "qty", title: "QTY", pct: 0.09, align: "right" },
          { key: "rate", title: "RATE", pct: 0.09, align: "right" },
          { key: "amount", title: "AMOUNT", pct: 0.09, align: "right" },
        ];
      } else {
        cols = [
          { key: "line", title: "#", pct: 0.05, align: "right" },
          { key: "department", title: "DEPARTMENT", pct: 0.15 },
          { key: "description", title: "DESCRIPTION", pct: 0.45 },
          { key: "uom", title: "UOM", pct: 0.08, align: "center" },
          { key: "qty", title: "QTY", pct: 0.09, align: "right" },
          { key: "rate", title: "RATE", pct: 0.09, align: "right" },
          { key: "amount", title: "AMOUNT", pct: 0.09, align: "right" },
        ];
      }

      let totalAssigned = 0;
      cols.forEach(col => {
        col.w = Math.floor(innerW * col.pct);
        totalAssigned += col.w;
      });

      const descColIndex = cols.findIndex(col => col.key === "description");
      if (descColIndex >= 0) {
        const remainder = innerW - totalAssigned;
        cols[descColIndex].w += remainder;
      }

      const xs = [x0];
      let cumulativeX = x0;
      for (let i = 0; i < cols.length; i++) {
        cumulativeX += cols[i].w;
        xs.push(cumulativeX);
      }

      const headerH = 30, baseH = 24;

      const drawTableHeader = () => {
        if (needSpaceForContent(headerH)) { }
        doc.setDrawColor(0, 0, 0);
        drawRect(x0, y, innerW, headerH);
        setSize(12); bold();
        cols.forEach((c, i) => {
          const cx = c.align === "right" ? xs[i + 1] - 10 :
            c.align === "center" ? (xs[i] + xs[i + 1]) / 2 :
              xs[i] + 10;
          const opt = c.align === "right" ? { align: "right" } :
            c.align === "center" ? { align: "center" } :
              {};
          text(c.title, cx, y + 20, opt);
          if (i > 0) {
            doc.setDrawColor(0, 0, 0);
            line(xs[i], y, xs[i], y + headerH);
          }
        });
        normal();
        y += headerH;
      };

      const drawTableRow = (r, idx) => {
        const descColIndex = cols.findIndex(col => col.key === "description");
        const shadeColIndex = shadeEnabled ? cols.findIndex(col => col.key === "shade") : -1;
        const descWidth = descColIndex >= 0 ? cols[descColIndex].w - 20 : 0;
        const shadeWidth = shadeColIndex >= 0 ? cols[shadeColIndex].w - 20 : 0;

        const descLines = doc.splitTextToSize(r.description || "", descWidth);
        const shadeLines = shadeEnabled ? doc.splitTextToSize(r.shade || "", shadeWidth) : [];
        const rowH = Math.max(baseH, descLines.length * 14 + 10, shadeLines.length * 14 + 10);

        if (needSpaceForContent(rowH)) {
          drawTableHeader();
        }

        doc.setDrawColor(0, 0, 0);
        drawRect(x0, y, innerW, rowH);
        for (let i = 1; i < xs.length - 1; i++) {
          doc.setDrawColor(0, 0, 0);
          line(xs[i], y, xs[i], y + rowH);
        }
        const yy = y + 16;

        let colIndex = 0;
        rtext(r.line ?? idx + 1, xs[colIndex + 1] - 10, yy);
        colIndex++;
        text(r.department || "", xs[colIndex] + 10, yy);
        colIndex++;
        descLines.forEach((ln, j) => text(ln, xs[colIndex] + 10, yy + j * 14));
        colIndex++;

        if (shadeEnabled) {
          if (shadeLines.length > 0) {
            shadeLines.forEach((ln, j) => text(ln, xs[colIndex] + 10, yy + j * 14));
          } else {
            text(r.shade || "", xs[colIndex] + 10, yy);
          }
          colIndex++;
        }

        text(r.uom || "", (xs[colIndex] + xs[colIndex + 1]) / 2, yy, { align: "center" });
        colIndex++;
        rtext(r._qtyStr, xs[colIndex + 1] - 10, yy);
        colIndex++;
        rtext(r._rateStr, xs[colIndex + 1] - 10, yy);
        colIndex++;
        rtext(r._amtStr, xs[colIndex + 1] - 10, yy);

        y += rowH;
        return (+r.qty || 0) * r._rateValue;
      };

      drawTableHeader();
      totalSum = 0;
      rows.forEach((r, i) => {
        totalSum += drawTableRow(r, i);
      });

      const finalGstAmount = gstEnabled && !isSupplierCopy ? (totalSum * gstPercentage) / 100 : 0;
      const finalGrandTotal = totalSum + finalGstAmount;
      const rateColIndex = cols.findIndex(col => col.key === "rate");
      const totalQty = rows.reduce((sum, r) => sum + (+r.qty || 0), 0);

      const subtotalH = 26;
      if (needSpaceForContent(subtotalH + (gstEnabled && !isSupplierCopy ? 26 : 0) + 30)) {
        drawTableHeader();
      }

      doc.setDrawColor(0, 0, 0);
      drawRect(x0, y, innerW, subtotalH);
      for (let i = 1; i < xs.length - 1; i++) {
        doc.setDrawColor(0, 0, 0);
        line(xs[i], y, xs[i], y + subtotalH);
      }
      setSize(12); bold();
      text("TOTAL QTY", x0 + 10, y + 18);
      const qtyColIndex = cols.findIndex(col => col.key === "qty");
      if (qtyColIndex >= 0) {
        rtext(totalQty.toLocaleString(), xs[qtyColIndex + 1] - 10, y + 18);
      }
      normal();
      y += subtotalH;

      doc.setDrawColor(0, 0, 0);
      drawRect(x0, y, innerW, subtotalH);
      if (rateColIndex >= 0) {
        doc.setDrawColor(0, 0, 0);
        line(xs[rateColIndex], y, xs[rateColIndex], y + subtotalH);
      }
      setSize(12); bold();
      text("SUBTOTAL", x0 + 10, y + 18);
      rtext(money(totalSum), xs[xs.length - 1] - 10, y + 18);
      normal();
      y += subtotalH;

      if (gstEnabled && !isSupplierCopy) {
        doc.setDrawColor(0, 0, 0);
        drawRect(x0, y, innerW, subtotalH);
        if (rateColIndex >= 0) {
          doc.setDrawColor(0, 0, 0);
          line(xs[rateColIndex], y, xs[rateColIndex], y + subtotalH);
        }
        setSize(12); bold();
        text(`GST ${gstPercentage}%`, x0 + 10, y + 18);
        rtext(money(finalGstAmount), xs[xs.length - 1] - 10, y + 18);
        normal();
        y += subtotalH;
      }

      const totalH = 30;
      doc.setDrawColor(0, 0, 0);
      drawRect(x0, y, innerW, totalH);
      if (rateColIndex >= 0) {
        doc.setDrawColor(0, 0, 0);
        line(xs[rateColIndex], y, xs[rateColIndex], y + totalH);
      }
      setSize(14); bold();
      const totalLabel = (gstEnabled && !isSupplierCopy) ? "GRAND TOTAL" : "TOTAL";
      text(totalLabel, x0 + 10, y + 20);
      rtext(money(finalGrandTotal), xs[xs.length - 1] - 10, y + 20);
      normal();
      y += totalH;
    })();

    drawFooterOnPage();
  };

  const originalRows = payload.rows.map(r => ({ ...r, rate: r.rate }));
  const supplierRows = payload.rows.map(r => ({ ...r, rate: 0 }));

  drawPODocument(originalRows, false);
  doc.addPage();
  drawPODocument(supplierRows, true);

  return doc;
}

export function downloadPdfBlob(doc, fileName) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "PO.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function postPOToSheet(webAppUrl, payload, { maxRetries = 3 } = {}) {
  if (!webAppUrl || !webAppUrl.includes("/exec")) return { ok: true, offline: true };
  const body = "data=" + encodeURIComponent(JSON.stringify(payload));
  let attempt = 0, delay = 400;
  while (true) {
    attempt++;
    try {
      const res = await fetch(webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        mode: "cors",
        body,
      });
      const json = await res.json().catch(() => null);

      if (res.status === 429 && attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      if (!res.ok) return { ok: false, status: res.status, json };
      if (!json?.ok) return { ok: false, status: json?.code || res.status, json };
      return { ok: true, json };
    } catch (err) {
      if (attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      return { ok: false, error: String(err) };
    }
  }
}

/** =========================
 * SmartDropdown Component (Portal-based)
 * ========================= */
function SmartDropdown({
  value,
  onChange,
  options = [],
  placeholder = "Select or type...",
  onSaveToLocalStorage,
  localStorageKey,
  required = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 220, isAbove: false });

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const portalRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    if (!inputValue || inputValue.trim() === "") {
      setFilteredOptions(options);
    } else {
      const q = inputValue.toLowerCase().trim();
      const filtered = options.filter(opt =>
        String(opt).toLowerCase().includes(q)
      );
      setFilteredOptions(filtered);
    }
  }, [inputValue, options]);

  const updateCoords = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Flip up if space below < 210px and space above is greater
      const isAbove = spaceBelow < 210 && spaceAbove > spaceBelow;

      const width = Math.max(rect.width, 240);
      let left = rect.left;
      if (left + width > window.innerWidth - 12) {
        left = Math.max(8, window.innerWidth - width - 12);
      }

      setCoords({
        top: isAbove ? rect.top - 4 : rect.bottom + 4,
        left,
        width,
        isAbove
      });
    }
  }, []);

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
  }, [isOpen, updateCoords]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        portalRef.current && !portalRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredOptions, isOpen]);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightedIndex];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(true);
    updateCoords();
  };

  const handleSelectOption = (option) => {
    setInputValue(option);
    onChange(option);
    setIsOpen(false);
    if (onSaveToLocalStorage && localStorageKey) {
      saveNameToLocalStorage(localStorageKey, option);
      onSaveToLocalStorage();
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (inputValue && inputValue.trim() && onSaveToLocalStorage && localStorageKey) {
        saveNameToLocalStorage(localStorageKey, inputValue);
        onSaveToLocalStorage();
      }
    }, 200);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        updateCoords();
        return;
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setHighlightedIndex(prev => (prev + 1 >= filteredOptions.length ? 0 : prev + 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setHighlightedIndex(prev => (prev <= 0 ? filteredOptions.length - 1 : prev - 1));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        e.preventDefault();
        handleSelectOption(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="smart-dropdown" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        className={`form-input ${required && !value ? 'required-field' : ''}`}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          setIsOpen(true);
          updateCoords();
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        style={{ width: '100%', boxSizing: 'border-box' }}
      />
      {isOpen && (filteredOptions.length > 0 || (inputValue && inputValue.trim())) && createPortal(
        <div
          ref={portalRef}
          className="smart-dropdown-portal-menu"
          style={{
            position: 'fixed',
            ...(coords.isAbove
              ? { bottom: `${window.innerHeight - coords.top}px` }
              : { top: `${coords.top}px` }),
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            backgroundColor: 'var(--bg-primary, #ffffff)',
            border: '1.5px solid var(--border-color, #cbd5e1)',
            borderRadius: '8px',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.08)',
            zIndex: 9999999,
            maxHeight: '220px',
            overflowY: 'auto',
            padding: '5px',
            boxSizing: 'border-box',
            fontFamily: 'inherit'
          }}
          onMouseDown={(e) => e.preventDefault()} // Prevents blur before click
        >
          <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const isSelected = String(option).toLowerCase().trim() === String(inputValue).toLowerCase().trim();
                const isHighlighted = index === highlightedIndex;
                return (
                  <div
                    key={index}
                    className="dropdown-option"
                    onClick={() => handleSelectOption(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    style={{
                      padding: '7px 11px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      backgroundColor: isHighlighted
                        ? 'rgba(2, 132, 199, 0.12)'
                        : isSelected
                        ? 'rgba(2, 132, 199, 0.06)'
                        : 'transparent',
                      color: isHighlighted || isSelected ? '#0284c7' : 'var(--text-main, #0f172a)',
                      fontWeight: isSelected ? '600' : '400',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {option}
                    </span>
                    {isSelected && <Check size={14} style={{ color: '#0284c7', flexShrink: 0 }} />}
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: 'var(--text-muted, #94a3b8)',
                  fontStyle: 'italic',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Press Enter to use "<b>{inputValue}</b>"</span>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function SearchableDesignSelect({ designs, value, onChange, placeholder = "-- Choose Approved Lot --" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedDesign = designs.find(d => String(d.id) === String(value));

  const filteredDesigns = designs.filter(d => {
    const q = searchQuery.toLowerCase();
    const idMatch = String(d.id).toLowerCase().includes(q);
    const nameMatch = String(d.name || '').toLowerCase().includes(q);
    const catMatch = String(d.category || '').toLowerCase().includes(q);
    return idMatch || nameMatch || catMatch;
  });

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 9999 : 1 }}>
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) {
            setSearchQuery('');
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          width: '100%',
          padding: '10px 14px',
          borderRadius: '10px',
          border: '1.5px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-primary, #f8fafc)',
          color: selectedDesign ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #64748b)',
          fontSize: '0.9rem',
          fontWeight: '500',
          transition: 'all 0.2s ease',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(99, 102, 241, 0.12)' : 'none',
          borderColor: isOpen ? '#6366f1' : 'var(--border-color, #e2e8f0)',
          height: '40px'
        }}
      >
        <span style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          paddingRight: '8px'
        }}>
          {selectedDesign ? `Lot ${selectedDesign.id} - ${selectedDesign.name} (${selectedDesign.category})` : placeholder}
        </span>
        <ChevronDown size={16} style={{
          color: 'var(--text-muted)',
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s ease',
          flexShrink: 0
        }} />
      </div>

      {isOpen && (
        <div className="po-dropdown-card" style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          border: '1.5px solid var(--border-color-dark, #94a3b8)',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08)',
          zIndex: 9999,
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: '260px'
        }}>
          <input
            type="text"
            placeholder="Type to search design or lot no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1.5px solid var(--border-color, #cbd5e1)',
              fontSize: '0.85rem',
              outline: 'none',
              background: 'var(--bg-primary, #f8fafc)',
              color: 'var(--text-main, #0f172a)'
            }}
            autoFocus
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', flex: 1 }}>
            <div
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearchQuery('');
              }}
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                color: 'var(--text-muted, #64748b)',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--bg-primary, #f8fafc)'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              {placeholder}
            </div>
            {filteredDesigns.map(d => (
              <div
                key={d.id}
                onClick={() => {
                  onChange(d.id);
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: String(value) === String(d.id) ? '700' : 'normal',
                  background: String(value) === String(d.id) ? 'var(--accent-light, rgba(99, 102, 241, 0.08))' : 'transparent',
                  color: String(value) === String(d.id) ? 'var(--accent-color, #6366f1)' : 'var(--text-main, #0f172a)',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (String(value) !== String(d.id)) {
                    e.target.style.background = 'var(--bg-primary, #f8fafc)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (String(value) !== String(d.id)) {
                    e.target.style.background = 'transparent';
                  }
                }}
              >
                Lot {d.id} - {d.name} ({d.category})
              </div>
            ))}
            {filteredDesigns.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                No designs found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** =========================
 * Main Component
 * ========================= */
export default function GeneratePOView({
  designs,
  vendors,
  pos = [],
  onAddPO,
  currencySymbol = 'R',
  prefilledPoData = null,
  setPrefilledPoData = () => { },
  materials = []
}) {
  const approvedDesigns = designs.filter(d => d.status === 'Approved');

  const [poViewMode, setPoViewMode] = useState('create');
  const [poSearchQuery, setPoSearchQuery] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState('all');
  const [poMaterialFilter, setPoMaterialFilter] = useState('all');
  const [poHistoryPage, setPoHistoryPage] = useState(0);
  const [poHistoryRpp, setPoHistoryRpp] = useState(10);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [livePOs, setLivePOs] = useState(Array.isArray(pos) ? pos : []);
  const [loadingLivePOs, setLoadingLivePOs] = useState(false);
  const [backendMaterialsList, setBackendMaterialsList] = useState([]);

  // Reset pagination when filter criteria change
  useEffect(() => {
    setPoHistoryPage(0);
  }, [poSearchQuery, poStatusFilter, poMaterialFilter]);

  // Compute filtered PO history records
  const filteredHistoryPOs = useMemo(() => {
    const targetList = livePOs.length > 0 ? livePOs : (pos || []);
    return targetList.filter(po => {
      const q = poSearchQuery.toLowerCase().trim();
      const s = (po.status || 'Sent to Vendor').toLowerCase();

      let matchesStatus = true;
      if (poStatusFilter === 'pending approval') {
        matchesStatus = s.includes('pending approval') || (s.includes('pending') && s.includes('app'));
      } else if (poStatusFilter === 'completed') {
        matchesStatus = s === 'completed' || s === 'received done';
      } else if (poStatusFilter === 'partially received') {
        matchesStatus = s.includes('partially') || s.includes('partial');
      } else if (poStatusFilter === 'sent to vendor') {
        matchesStatus = s.includes('sent') || s.includes('vendor') || s.includes('draft') || s.includes('active') || s.includes('issued');
      }

      let matchesMaterial = true;
      if (poMaterialFilter !== 'all') {
        const filterMatLower = poMaterialFilter.toLowerCase();
        let found = false;
        if (po.items) {
          try {
            const itms = typeof po.items === 'string' ? JSON.parse(po.items) : po.items;
            if (Array.isArray(itms)) {
              found = itms.some(i => (i.name || i.description || i.item || '').toLowerCase() === filterMatLower);
            }
          } catch (_) { }
        }
        matchesMaterial = found;
      }

      let matchesSearch = true;
      if (q) {
        const cleanQ = q.replace(/^po-?/i, '').trim();
        const poNum = String(po.poNumber || '').toLowerCase();
        const cleanPoNum = poNum.replace(/^po-?/i, '').trim();
        const vName = String(po.vendorName || '').toLowerCase();
        const dName = String(po.designName || '').toLowerCase();
        const dCat = String(po.designCategory || '').toLowerCase();

        let itemNames = '';
        if (po.items) {
          try {
            const itms = typeof po.items === 'string' ? JSON.parse(po.items) : po.items;
            itemNames = Array.isArray(itms) ? itms.map(i => (i.name || i.description || i.item || '')).join(' ').toLowerCase() : '';
          } catch (_) { }
        }

        matchesSearch =
          poNum.includes(q) ||
          (cleanQ && cleanPoNum.includes(cleanQ)) ||
          vName.includes(q) ||
          dName.includes(q) ||
          dCat.includes(q) ||
          itemNames.includes(q);
      }

      return matchesStatus && matchesMaterial && matchesSearch;
    });
  }, [livePOs, pos, poSearchQuery, poStatusFilter, poMaterialFilter]);

  // Compute paginated slice of PO records
  const paginatedHistoryPOs = useMemo(() => {
    const start = poHistoryPage * poHistoryRpp;
    return filteredHistoryPOs.slice(start, start + poHistoryRpp);
  }, [filteredHistoryPOs, poHistoryPage, poHistoryRpp]);

  const fetchLivePOs = async () => {
    try {
      setLoadingLivePOs(true);
      const [posRes, matRes] = await Promise.all([
        fetch(`${getBackendUrl()}/api/pos`),
        fetch(`${getBackendUrl()}/api/pos/materials`).catch(() => null)
      ]);
      if (posRes.ok) {
        const data = await posRes.json();
        if (Array.isArray(data)) {
          setLivePOs(data);
        }
      }
      if (matRes && matRes.ok) {
        const mData = await matRes.json();
        if (mData.success && Array.isArray(mData.materials)) {
          setBackendMaterialsList(mData.materials);
        }
      }
    } catch (err) {
      console.error('Failed to fetch live POs:', err);
    } finally {
      setLoadingLivePOs(false);
    }
  };

  useEffect(() => {
    fetchLivePOs();
  }, [poViewMode]);

  useEffect(() => {
    if (Array.isArray(pos) && pos.length > 0) {
      setLivePOs(pos);
    }
  }, [pos]);

  const handleLoadPOFromHistory = async (poNumberStr) => {
    setSearchPoNumber(poNumberStr);
    setPoViewMode('create');
    setIsLoadingPO(true);
    setLoadError("");
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/pos/${encodeURIComponent(poNumberStr.trim())}`);
      if (res.ok) {
        const po = await res.json();
        if (po) {
          const targetPo = po.poNumber || poNumberStr.trim();
          handleRegeneratePoNumber();

          const vName = po.vendorName || "";
          setSupplierName(vName);
          const matchedVendor = vendors.find(v => (v.name || '').toLowerCase() === vName.toLowerCase() || String(v.id) === String(vName));
          if (matchedVendor) {
            setSelectedVendorId(String(matchedVendor.id));
          }

          if (po.date) {
            const parts = po.date.split(' ');
            setOrderDate(parts[0]);
            if (parts[1]) setOrderTime(parts[1].slice(0, 5));
          }
          if (po.deliveryDate) {
            const dparts = po.deliveryDate.split(' ');
            setExpectedDate(dparts[0]);
            if (dparts[1]) setExpectedTime(dparts[1].slice(0, 5));
          }

          if (po.remarks) setRemarks(po.remarks);
          if (po.requisitionRaisedBy) setRequisitionRaisedBy(po.requisitionRaisedBy);
          if (po.preparedBy) setPreparedBy(po.preparedBy);
          if (po.approvedBy) setApprovedBy(po.approvedBy);

          if (po.tax !== undefined && po.tax !== null) {
            setGstEnabled(parseFloat(po.tax) > 0);
            if (po.taxRate) setGstPercentage(parseFloat(po.taxRate));
          }

          if (po.items) {
            let poRows = [];
            if (Array.isArray(po.items)) {
              poRows = po.items;
            } else {
              try {
                poRows = JSON.parse(po.items || '[]');
              } catch (_) { }
            }
            if (poRows.length > 0) {
              setRows(poRows.map(item => {
                const isMySQL = item.name !== undefined;
                const desc = isMySQL ? (item.name || "") : (item.description || item.item || "");

                let dept = "";
                if (desc) {
                  const matched = sheetRows.find(r => r.item && r.item.toLowerCase().trim() === desc.toLowerCase().trim());
                  if (matched) dept = matched.dept || "";
                }
                if (!dept) dept = item.department || item.dept || "Trims";

                return {
                  department: dept,
                  description: desc,
                  shade: isMySQL ? (item.description || "") : (item.shade || ""),
                  uom: isMySQL ? (item.unit || "PCS") : (item.uom || item.unit || "PCS"),
                  qty: parseFloat(isMySQL ? item.qty : (item.qty || item.quantity)) || 0,
                  rate: parseFloat(isMySQL ? item.price : (item.rate || item.price)) || 0
                };
              }));
            }
          }
          setLocalStorageItem(LOCAL_STORAGE_KEYS.LAST_PO_NUMBER, targetPo);
          alert(`Successfully loaded PO ${targetPo} into active editor.`);
        }
      }
    } catch (err) {
      alert("Failed to load PO: " + err.message);
    } finally {
      setIsLoadingPO(false);
    }
  };

  const handleDownloadPOFromHistory = async (po) => {
    let poRows = [];
    if (Array.isArray(po.items)) {
      poRows = po.items;
    } else {
      try {
        poRows = JSON.parse(po.items || '[]');
      } catch (err) {
        console.error("Failed to parse po items:", err);
      }
    }

    const payload = {
      meta: {
        poNumber: po.poNumber,
        orderDate: po.date ? po.date.split(' ')[0] : todayISO(),
        orderTime: po.date ? po.date.split(' ')[1] : nowTime(),
        expectedDate: po.deliveryDate || null,
        expectedTime: null,
        requisitionRaisedBy: po.requisitionRaisedBy || "SYSTEM",
        preparedBy: po.preparedBy || "SYSTEM",
        approvedBy: po.approvedBy || "SYSTEM",
        remarks: po.remarks || "",
        createdAt: po.date || new Date().toISOString(),
        shadeEnabled: poRows.some(r => r.description),
        gstEnabled: po.tax > 0,
        gstPercentage: po.taxRate || 18,
      },
      supplierName: po.vendorName || '',
      // supplierAddress: po.vendorAddress || '',
      // supplierEmail: po.vendorEmail || '',
      // supplierPhone: '',
      rows: poRows.map((r, i) => {
        const isMySQLFormat = r.name !== undefined;
        return {
          line: r.line || (i + 1),
          department: r.department || r.dept || "Trims",
          description: isMySQLFormat ? r.name : (r.description || r.item || ""),
          shade: isMySQLFormat ? r.description : (r.shade || ""),
          uom: isMySQLFormat ? r.unit : (r.uom || r.unit || "PCS"),
          qty: parseFloat(isMySQLFormat ? r.qty : (r.qty || r.quantity)) || 0,
          rate: parseFloat(isMySQLFormat ? r.price : (r.rate || r.price)) || 0,
          amount: (parseFloat(isMySQLFormat ? r.qty : r.qty) || 0) * (parseFloat(isMySQLFormat ? r.price : r.rate) || 0)
        };
      }),
      totals: {
        sub: po.subtotal || 0,
        gstAmount: po.tax || 0,
        grandTotal: po.total || 0
      }
    };

    const systemBaseUrl = await resolveLocalSystemUrl();
    const { gateUrl, recvUrl } = buildPoQrUrls({
      base: systemBaseUrl || WEB_APP_BASE,
      poNo: po.poNumber,
      orderDate: payload.meta.orderDate,
      expectedDate: payload.meta.expectedDate,
      supervisorName: po.preparedBy || po.approvedBy,
    });

    const [gateQR, recvQR] = await Promise.all([
      toDataURL_QR(gateUrl, 320),
      toDataURL_QR(recvUrl, 320),
    ]);

    const doc = generatePurchaseOrderPDF({
      payload,
      options: {
        qrGateImage: gateQR,
        qrRecvImage: recvQR,
        qrSide: 96,
        shadeEnabled: payload.meta.shadeEnabled,
        gstEnabled: payload.meta.gstEnabled,
        gstPercentage: payload.meta.gstPercentage
      },
    });

    downloadPdfBlob(doc, `${po.poNumber}.pdf`);
  };

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/design-history`)
      .then(res => {
        if (res.ok) return res.json();
        return [];
      })
      .then(data => setHistoryLogs(data))
      .catch(err => console.error(err));
  }, []);

  const getDesignHistoryLogs = () => {
    if (!selectedDesignId) return [];
    const logs = [];
    const designObj = approvedDesigns.find(d => String(d.id) === String(selectedDesignId));

    // Find logs matching current lot ID
    historyLogs.forEach(h => {
      if (String(h.lotId).toLowerCase() === String(selectedDesignId).toLowerCase()) {
        logs.push(h);
      }
    });

    return logs;
  };

  const [poNumber, setPoNumber] = useState(() => {
    return generateNextPoNumber(Array.isArray(pos) ? pos.map(p => p.poNumber) : []);
  });
  const [orderDate, setOrderDate] = useState(todayISO());
  const [orderTime, setOrderTime] = useState(nowTime());
  const [expectedDate, setExpectedDate] = useState("");
  const [expectedTime, setExpectedTime] = useState("");
  const [supplierName, setSupplierName] = useState("");
  // const [supplierAddress, setSupplierAddress] = useState("");
  // const [supplierEmail, setSupplierEmail] = useState("");
  // const [supplierPhone, setSupplierPhone] = useState("");
  const [rows, setRows] = useState([blankRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSupervisorDialog, setShowSupervisorDialog] = useState(false);

  const [requisitionRaisedBy, setRequisitionRaisedBy] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [remarks, setRemarks] = useState("");

  const [savedRequisitionNames, setSavedRequisitionNames] = useState(() =>
    getLocalStorageItem(LOCAL_STORAGE_KEYS.REQUISITION_NAMES, DEFAULT_REQUISITION_NAMES)
  );
  const [savedPreparedNames, setSavedPreparedNames] = useState(() =>
    getLocalStorageItem(LOCAL_STORAGE_KEYS.PREPARED_NAMES, DEFAULT_PREPARED_NAMES)
  );
  const [savedApprovedNames, setSavedApprovedNames] = useState(() =>
    getLocalStorageItem(LOCAL_STORAGE_KEYS.APPROVED_NAMES, DEFAULT_APPROVED_NAMES)
  );

  const [searchPoNumber, setSearchPoNumber] = useState("");
  const [isLoadingPO, setIsLoadingPO] = useState(false);
  const [availablePONumbers, setAvailablePONumbers] = useState([]);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [shadeEnabled, setShadeEnabled] = useState(() =>
    getLocalStorageItem(LOCAL_STORAGE_KEYS.SHADE_ENABLED, false)
  );
  const [savedDescriptions, setSavedDescriptions] = useState(() =>
    getLocalStorageItem(LOCAL_STORAGE_KEYS.DESCRIPTIONS, [])
  );
  const [savedShades, setSavedShades] = useState(() =>
    getLocalStorageItem(LOCAL_STORAGE_KEYS.SHADES, [])
  );

  // Real-time Autocomplete state savers
  const saveDescriptionWithDebounce = (description) => {
    if (!description || !description.trim()) return;
    window.saveDescriptionTimeout = window.saveDescriptionTimeout || null;
    if (window.saveDescriptionTimeout) clearTimeout(window.saveDescriptionTimeout);
    window.saveDescriptionTimeout = setTimeout(() => {
      const trimmedValue = description.trim();
      if (trimmedValue.length < 2) return;
      const savedItems = getLocalStorageItem(LOCAL_STORAGE_KEYS.DESCRIPTIONS, []);
      if (!savedItems.includes(trimmedValue)) {
        const updatedItems = [trimmedValue, ...savedItems.filter(item => item !== trimmedValue)];
        setLocalStorageItem(LOCAL_STORAGE_KEYS.DESCRIPTIONS, updatedItems.slice(0, 50));
        setSavedDescriptions(updatedItems.slice(0, 50)); // Live React sync
      }
    }, 800);
  };

  const saveShadeWithDebounce = (shade) => {
    if (!shade || !shade.trim()) return;
    window.saveShadeTimeout = window.saveShadeTimeout || null;
    if (window.saveShadeTimeout) clearTimeout(window.saveShadeTimeout);
    window.saveShadeTimeout = setTimeout(() => {
      const trimmedValue = shade.trim();
      if (trimmedValue.length < 2) return;
      const savedItems = getLocalStorageItem(LOCAL_STORAGE_KEYS.SHADES, []);
      if (!savedItems.includes(trimmedValue)) {
        const updatedItems = [trimmedValue, ...savedItems.filter(item => item !== trimmedValue)];
        setLocalStorageItem(LOCAL_STORAGE_KEYS.SHADES, updatedItems.slice(0, 50));
        setSavedShades(updatedItems.slice(0, 50)); // Live React sync
      }
    }, 800);
  };

  const [gstEnabled, setGstEnabled] = useState(() =>
    getLocalStorageItem(LOCAL_STORAGE_KEYS.GST_ENABLED, false)
  );
  const [gstPercentage, setGstPercentage] = useState(() =>
    getLocalStorageItem(LOCAL_STORAGE_KEYS.GST_PERCENTAGE, 18)
  );
  const [showGstDialog, setShowGstDialog] = useState(false);

  const [sheetRows, setSheetRows] = useState([]);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState("");

  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [poMode, setPoMode] = useState('lot'); // 'lot' | 'normal'

  const handlePoModeChange = (mode) => {
    setPoMode(mode);
    if (mode === 'normal') {
      setSelectedDesignId('');
      setRows([blankRow()]);
    }
  };

  // Left editor active steps tab state
  const [leftActiveTab, setLeftActiveTab] = useState('specs');

  // Load PO numbers and sheet config
  // Immediately fetch authoritative next unique PO number on mount
  useEffect(() => {
    fetch(`${getBackendUrl()}/api/pos/next-number`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.nextPoNumber) {
          setPoNumber(data.nextPoNumber);
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    loadAvailablePONumbers();
  }, [pos]);

  async function loadAvailablePONumbers(newlyAddedPoNo = null) {
    try {
      // 1. Fetch server's authoritative next PO number
      let serverNextPo = null;
      try {
        const sRes = await fetch(`${getBackendUrl()}/api/pos/next-number`);
        const sData = await sRes.json();
        if (sData.success && sData.nextPoNumber) {
          serverNextPo = sData.nextPoNumber;
        }
      } catch (_) { }

      // 2. Fetch only already generated POs from database
      let dbPoNumbers = [];
      try {
        const pRes = await fetch(`${getBackendUrl()}/api/pos`);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (Array.isArray(pData)) {
            dbPoNumbers = pData
              .map(p => (p.poNumber || '').trim())
              .filter(Boolean);
          }
        }
      } catch (_) { }

      // Map local MySQL POs if passed via props
      const localPoNumbers = Array.isArray(pos) ? pos.map(p => (p.poNumber || '').trim()) : [];

      // Combine ONLY already generated PO numbers
      const combined = Array.from(new Set([...dbPoNumbers, ...localPoNumbers].filter(Boolean)));
      if (newlyAddedPoNo && !combined.includes(newlyAddedPoNo.trim())) {
        combined.push(newlyAddedPoNo.trim());
      }

      // Sort properly descending by number
      combined.sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numB - numA;
      });

      setAvailablePONumbers(combined);
      if (!prefilledPoData) {
        const localNext = generateNextPoNumber(combined);
        setPoNumber(serverNextPo || localNext);
      }
    } catch (e) {
      console.warn("Could not load PO numbers list:", e);
    }
  }

  // Pre-fill PO handler
  useEffect(() => {
    if (prefilledPoData) {
      setSelectedDesignId(prefilledPoData.lotId || '');
      setRows([
        {
          department: "Trims",
          description: prefilledPoData.itemName || "",
          shade: "",
          uom: prefilledPoData.unit || 'PCS',
          qty: prefilledPoData.qty || 0,
          rate: 0
        }
      ]);
      setPrefilledPoData(null);
    }
  }, [prefilledPoData, setPrefilledPoData]);

  const handleRegeneratePoNumber = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/pos/next-number`);
      const data = await res.json();
      if (data.success && data.nextPoNumber) {
        setPoNumber(data.nextPoNumber);
        return;
      }
    } catch (_) { }
    setPoNumber(generateNextPoNumber(availablePONumbers));
  };

  const makeUniquePoNumber = () => {
    handleRegeneratePoNumber();
  };

  // Approved Design autofill mapping
  const handleDesignChange = (designId) => {
    setSelectedDesignId(designId);
    if (!designId) {
      setRows([blankRow()]);
      return;
    }
    const design = designs.find(d => d.id === designId);
    if (design && design.bom) {
      const mapped = design.bom
        .filter(item => String(item.status).toLowerCase() === 'yes')
        .map(item => ({
          department: item.category || 'Trims',
          description: item.name + (item.detail ? ` (${item.detail})` : ''),
          shade: '',
          uom: 'PCS',
          qty: 100,
          rate: 0
        }));
      setRows(mapped.length > 0 ? mapped : [blankRow()]);
    }
  };

  // Vendor profiles autofill mapping
  const handleVendorChange = (vendorId) => {
    setSelectedVendorId(vendorId);
    if (!vendorId) {
      setSupplierName("");
      return;
    }
    const vendor = vendors.find(v => String(v.id) === String(vendorId) || String(v.name) === String(vendorId));
    if (vendor && vendor.name) {
      setSupplierName(vendor.name);
    } else {
      setSupplierName(vendorId);
    }
  };

  // Load custom Sheet row options
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingSheet(true);
        const data = await fetchSheetRows(SHEET_ID, RANGE_A1, API_KEY);
        if (mounted) setSheetRows(data);
      } catch (err) {
        if (mounted) setSheetError(err?.message || "Failed to load sheet items.");
      } finally {
        if (mounted) setLoadingSheet(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setLocalStorageItem(LOCAL_STORAGE_KEYS.SHADE_ENABLED, shadeEnabled);
  }, [shadeEnabled]);

  useEffect(() => {
    setLocalStorageItem(LOCAL_STORAGE_KEYS.GST_ENABLED, gstEnabled);
    setLocalStorageItem(LOCAL_STORAGE_KEYS.GST_PERCENTAGE, gstPercentage);
  }, [gstEnabled, gstPercentage]);

  const departments = useMemo(() => {
    const set = new Set(sheetRows.map((r) => r.dept).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sheetRows]);

  const itemsByDept = useMemo(() => {
    const map = new Map();
    sheetRows.forEach(({ dept, item }) => {
      if (!dept || !item) return;
      if (!map.has(dept)) map.set(dept, new Set());
      map.get(dept).add(item);
    });
    const obj = {};
    for (const [k, v] of map.entries()) obj[k] = Array.from(v).sort((a, b) => a.localeCompare(b));
    return obj;
  }, [sheetRows]);

  const totals = useMemo(() => {
    let sub = 0;
    rows.forEach((r) => (sub += (+r.qty || 0) * (+r.rate || 0)));
    const gstAmount = gstEnabled ? (sub * gstPercentage) / 100 : 0;
    const grandTotal = sub + gstAmount;
    return { sub, gstAmount, grandTotal };
  }, [rows, gstEnabled, gstPercentage]);

  const orderDT = toDate(orderDate, orderTime);
  const expectedDT = toDate(expectedDate, expectedTime);
  const leadMs = orderDT && expectedDT ? expectedDT - orderDT : null;
  const leadHuman = humanDuration(leadMs);

  const updateRow = (idx, patch) => {
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addRow = () => setRows(prev => [...prev, blankRow()]);

  const removeRow = (idx) =>
    setRows(prev => (prev.length === 1 ? [blankRow()] : prev.filter((_, i) => i !== idx)));

  const validate = () => {
    const errs = [];
    if (!poNumber.trim()) errs.push("PO Number is required.");
    if (!supplierName.trim()) errs.push("Supplier Name is required.");
    if (!orderDate) errs.push("Order Date is required.");

    let hasValidLine = false;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.department && r.description && r.uom && (+r.qty || 0) > 0) {
        hasValidLine = true;
      }
    }
    if (!hasValidLine) errs.push("At least one complete line item (Department, Description, UOM, and Qty > 0) is required.");
    if (orderDT && expectedDT && expectedDT < orderDT)
      errs.push("Expected Material Date/Time cannot be before Order Date/Time.");

    return errs;
  };

  const makePayload = () => ({
    meta: {
      poNumber,
      orderDate: orderDate || null,
      orderTime: orderTime || null,
      expectedDate: expectedDate || null,
      expectedTime: expectedTime || null,
      orderDateTimeISO: orderDT ? orderDT.toISOString() : null,
      expectedDateTimeISO: expectedDT ? expectedDT.toISOString() : null,
      leadTimeMs: leadMs,
      leadTimeHuman: leadHuman || null,
      requisitionRaisedBy: requisitionRaisedBy || null,
      preparedBy: preparedBy || null,
      approvedBy: approvedBy || null,
      remarks: remarks || "",
      createdAt: new Date().toISOString(),
      shadeEnabled,
      gstEnabled,
      gstPercentage: gstEnabled ? gstPercentage : 0,
    },
    supplierName,
    // supplierAddress,
    // supplierEmail,
    // supplierPhone,
    rows: rows.map((r, i) => ({
      line: i + 1,
      department: r.department,
      description: r.description,
      shade: r.shade || "",
      uom: r.uom,
      qty: +r.qty || 0,
      rate: +r.rate || 0,
      amount: (+r.qty || 0) * (+r.rate || 0),
    })),
    totals,
  });

  const resetForm = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/pos/next-number`);
      const data = await res.json();
      if (data.success && data.nextPoNumber) {
        setPoNumber(data.nextPoNumber);
      } else {
        setPoNumber(generateNextPoNumber(availablePONumbers));
      }
    } catch (_) {
      setPoNumber(generateNextPoNumber(availablePONumbers));
    }
    setOrderDate(todayISO());
    setOrderTime(nowTime());
    setExpectedDate("");
    setExpectedTime("");
    setSupplierName("");
    setRows([blankRow()]);
    setSelectedDesignId("");
    setPoMode("lot");
    setRequisitionRaisedBy("");
    setPreparedBy("");
    setApprovedBy("");
    setRemarks("");
  };

  // Saved names refreshers
  const refreshSavedNames = () => {
    setSavedRequisitionNames(getLocalStorageItem(LOCAL_STORAGE_KEYS.REQUISITION_NAMES, DEFAULT_REQUISITION_NAMES));
    setSavedPreparedNames(getLocalStorageItem(LOCAL_STORAGE_KEYS.PREPARED_NAMES, DEFAULT_PREPARED_NAMES));
    setSavedApprovedNames(getLocalStorageItem(LOCAL_STORAGE_KEYS.APPROVED_NAMES, DEFAULT_APPROVED_NAMES));
  };

  // Google Sheets & Database load handler
  const handleLoadPO = async () => {
    if (!searchPoNumber.trim()) return setLoadError("Please enter a PO number");
    setIsLoadingPO(true);
    setLoadError("");
    const targetPoNum = searchPoNumber.trim();
    try {
      // 1. Try local database first
      let loadedFromLocal = false;
      try {
        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/api/pos/${encodeURIComponent(targetPoNum)}`);
        if (res.ok) {
          const po = await res.json();
          if (po) {
            handleRegeneratePoNumber();
            const vName = po.vendorName || "";
            setSupplierName(vName);
            const matchedVendor = vendors.find(v => (v.name || '').toLowerCase() === vName.toLowerCase() || String(v.id) === String(vName));
            if (matchedVendor) {
              setSelectedVendorId(String(matchedVendor.id));
            }

            if (po.date) {
              const parts = po.date.split(' ');
              setOrderDate(parts[0]);
              if (parts[1]) setOrderTime(parts[1].slice(0, 5));
            }
            if (po.deliveryDate) {
              const dparts = po.deliveryDate.split(' ');
              setExpectedDate(dparts[0]);
              if (dparts[1]) setExpectedTime(dparts[1].slice(0, 5));
            }

            if (po.remarks) setRemarks(po.remarks);
            if (po.requisitionRaisedBy) setRequisitionRaisedBy(po.requisitionRaisedBy);
            if (po.preparedBy) setPreparedBy(po.preparedBy);
            if (po.approvedBy) setApprovedBy(po.approvedBy);

            if (po.tax !== undefined && po.tax !== null) {
              setGstEnabled(parseFloat(po.tax) > 0);
              if (po.taxRate) setGstPercentage(parseFloat(po.taxRate));
            }

            let poRows = [];
            if (Array.isArray(po.items)) {
              poRows = po.items;
            } else if (typeof po.items === 'string') {
              try { poRows = JSON.parse(po.items); } catch (_) { poRows = []; }
            }

            if (poRows.length > 0) {
              setRows(poRows.map((item, idx) => {
                const isMySQL = item.name !== undefined;
                const desc = isMySQL ? (item.name || "") : (item.description || item.item || "");

                // Find matching department from sheetRows by looking up description
                let dept = "";
                if (desc) {
                  const matched = sheetRows.find(r => r.item && r.item.toLowerCase().trim() === desc.toLowerCase().trim());
                  if (matched) {
                    dept = matched.dept || "";
                  }
                }
                if (!dept) {
                  dept = item.department || item.dept || "Trims";
                }

                return {
                  line: item.line || (idx + 1),
                  department: dept,
                  description: desc,
                  shade: isMySQL ? (item.description || "") : (item.shade || ""),
                  uom: isMySQL ? (item.unit || "PCS") : (item.uom || item.unit || "PCS"),
                  qty: parseFloat(isMySQL ? item.qty : (item.qty || item.quantity)) || 0,
                  rate: parseFloat(isMySQL ? item.price : (item.rate || item.price)) || 0
                };
              }));
            }

            loadedFromLocal = true;
            setLocalStorageItem(LOCAL_STORAGE_KEYS.LAST_PO_NUMBER, targetPoNum);
            alert(`Successfully loaded PO ${targetPoNum} into active editor.`);
            setShowLoadDialog(false);
          }
        }
      } catch (localErr) {
        console.warn("Failed to load PO from local database:", localErr);
      }

      // 2. Fallback to Google Sheets if local DB fetch didn't load it
      if (!loadedFromLocal) {
        const poData = await fetchPODataByNumber(targetPoNum, SHEET_ID, API_KEY);
        if (poData && poData.length > 0) {
          handleRegeneratePoNumber();
          const loadedRows = poData.map((item, idx) => ({
            line: idx + 1,
            department: item.department || "Trims",
            description: item.description || "",
            shade: "",
            uom: item.uom || "PCS",
            qty: item.qty || 0,
            rate: item.rate || 0
          }));
          setRows(loadedRows);
          setLocalStorageItem(LOCAL_STORAGE_KEYS.LAST_PO_NUMBER, targetPoNum);
          alert(`Successfully loaded PO ${targetPoNum} from sheets.`);
          setShowLoadDialog(false);
        } else {
          setLoadError(`PO ${targetPoNum} not found in database or Google Sheets.`);
        }
      }
    } catch (err) {
      setLoadError("Failed to load PO: " + err.message);
    } finally {
      setIsLoadingPO(false);
    }
  };

  // Submit and issue handler (Local MySQL save + Sheets sync + PDF download)
  const handleConfirmSubmit = async () => {
    const errs = validate();
    if (errs.length) return alert("Please check inputs:\n\n" + errs.join("\n"));

    if (!requisitionRaisedBy.trim()) return alert("Requisition Raised By is required.");
    if (!preparedBy.trim()) return alert("Prepared By is required.");
    if (!approvedBy.trim()) return alert("Authorized By is required.");

    setIsSubmitting(true);
    setShowSupervisorDialog(false);

    try {
      const payload = makePayload();

      // Save locally to MySQL Database via Parent App Handler
      const mappedItemsForMySQL = payload.rows.map(r => ({
        name: r.description,
        qty: r.qty,
        price: r.rate,
        unit: r.uom,
        description: r.shade || ''
      }));

      const mySqlPo = {
        id: `PO${Math.floor(1000 + Math.random() * 9000)}`,
        poNumber: payload.meta.poNumber,
        vendorName: payload.supplierName,
        // vendorEmail: payload.supplierEmail,
        // vendorAddress: payload.supplierAddress,
        designName: selectedDesignId ? designs.find(d => d.id === selectedDesignId)?.name : 'Custom PO',
        designCategory: selectedDesignId ? designs.find(d => d.id === selectedDesignId)?.category : 'N/A',
        items: mappedItemsForMySQL,
        subtotal: totals.sub,
        taxRate: gstPercentage,
        tax: totals.gstAmount,
        total: totals.grandTotal,
        date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        deliveryDate: expectedDate ? new Date(expectedDate).toLocaleDateString('en-GB') : '',
        status: 'Sent to Vendor'
      };

      // Call parent MySQL database sync callback
      await onAddPO(mySqlPo);

      // Sheets Sync
      try {
        await postPOToSheet(WEB_APP_BASE, payload);
      } catch (sheetsErr) {
        console.warn("Failed Sheets backup sync:", sheetsErr);
      }

      // Generate local scanner QR code URLs using local server address
      const systemBaseUrl = await resolveLocalSystemUrl();
      const { gateUrl, recvUrl } = buildPoQrUrls({
        base: systemBaseUrl || WEB_APP_BASE,
        poNo: payload.meta.poNumber,
        orderDate: payload.meta.orderDate,
        expectedDate: payload.meta.expectedDate,
        supervisorName: preparedBy || approvedBy,
      });

      const [gateQR, recvQR] = await Promise.all([
        toDataURL_QR(gateUrl, 320),
        toDataURL_QR(recvUrl, 320),
      ]);

      const doc = generatePurchaseOrderPDF({
        payload,
        options: {
          qrGateImage: gateQR,
          qrRecvImage: recvQR,
          qrSide: 96,
          shadeEnabled,
          gstEnabled,
          gstPercentage: gstEnabled ? gstPercentage : 0
        },
      });

      downloadPdfBlob(doc, `${payload.meta.poNumber}.pdf`);
      alert(`PO ${payload.meta.poNumber} has been successfully issued & stored in local MySQL database!`);
      resetForm();
      loadAvailablePONumbers(payload.meta.poNumber);
    } catch (e) {
      alert("Submission error: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdfPreview = async () => {
    const errs = validate();
    if (errs.length) return alert("Please check inputs before downloading:\n\n" + errs.join("\n"));
    const payload = makePayload();

    const systemBaseUrl = await resolveLocalSystemUrl();
    const { gateUrl, recvUrl } = buildPoQrUrls({
      base: systemBaseUrl || WEB_APP_BASE,
      poNo: payload.meta.poNumber,
      orderDate: payload.meta.orderDate,
      expectedDate: payload.meta.expectedDate,
      supervisorName: preparedBy || approvedBy,
    });

    const [gateQR, recvQR] = await Promise.all([
      toDataURL_QR(gateUrl, 320),
      toDataURL_QR(recvUrl, 320),
    ]);

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
    downloadPdfBlob(doc, `${poNumber}_preview.pdf`);
  };

  return (
    <div className="page-container" style={{ padding: '0 0 40px 0' }}>
      <style>{`
        .po-split-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 28px;
          align-items: start;
        }
        .po-dropdown-card {
          background: #ffffff !important;
        }
        body.dark-theme .po-dropdown-card {
          background: #131924 !important;
        }
        .po-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .po-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .step-tabs {
          display: flex;
          background: var(--bg-primary, #f8fafc);
          padding: 6px;
          border-radius: 14px;
          margin-bottom: 24px;
          gap: 6px;
          border: 1px solid var(--border-color, #e2e8f0);
        }
        .step-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-align: center;
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted, #64748b);
          cursor: pointer;
          border-radius: 10px;
          border: none;
          background: transparent;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .step-tab:hover {
          color: var(--text-main, #0f172a);
          background: rgba(99, 102, 241, 0.05);
        }
        .step-tab.active {
          color: #ffffff;
          background: var(--accent-color, #6366f1);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
        }
        .preset-row {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }
        .preset-pill {
          padding: 6px 12px;
          border-radius: 20px;
          border: 1px solid var(--border-color);
          background: var(--bg-primary);
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .preset-pill:hover {
          color: var(--text-main);
          border-color: var(--text-main);
        }
        .preset-pill.active {
          background: var(--accent-color);
          color: #fff;
          border-color: var(--accent-color);
        }
        .required-field {
          border-color: var(--danger) !important;
        }
        .FormLabel {
          font-size: 10px;
          font-weight: 800;
          color: var(--text-muted);
          margin-bottom: 6px;
          display: block;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .po-input-group {
          display: flex;
          gap: 8px;
          width: 100%;
        }

        /* WYSIWYG Paper Document Preview styling */
        .po-document-paper {
          background: #ffffff;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 20px;
          box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.08), 0 8px 16px -8px rgba(15, 23, 42, 0.04);
          padding: 36px;
          min-height: 700px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          transition: all 0.3s ease;
        }
        .paper-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid var(--text-main, #0f172a);
          padding-bottom: 14px;
          margin-bottom: 20px;
        }
        .paper-company-title {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-main, #0f172a);
          letter-spacing: 0.02em;
        }
        .paper-po-badge {
          background: var(--accent-light, rgba(99, 102, 241, 0.08));
          color: var(--accent-color, #6366f1);
          font-size: 13px;
          font-weight: 800;
          padding: 4px 12px;
          border-radius: 20px;
          border: 1.5px solid var(--accent-color, #6366f1);
        }
        .paper-metadata-block {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          font-size: 13px;
          margin-bottom: 24px;
          line-height: 1.6;
          background: var(--bg-primary, #f8fafc);
          padding: 16px;
          border-radius: 12px;
          border: 1px solid var(--border-color, #e2e8f0);
        }
        .paper-meta-col strong {
          color: var(--text-muted, #64748b);
          font-weight: 700;
          margin-right: 6px;
        }
        
        /* Inline input details in table list */
        .po-document-paper .custom-table-container {
          width: 100%;
          overflow-x: auto;
          overflow-y: visible;
          padding-top: 6px;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .po-document-paper .custom-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-top: 2px;
        }
        .po-document-paper .custom-table thead th {
          padding: 10px 8px;
          font-size: 11px;
          font-weight: 800;
          color: var(--text-muted, #64748b);
          border-top: 1px solid var(--border-color, #e2e8f0);
          border-bottom: 2px solid var(--border-color, #e2e8f0);
          background: var(--bg-primary, #f8fafc);
          vertical-align: middle;
          line-height: 1.5;
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .po-document-paper .custom-table thead th:first-child {
          border-left: 1px solid var(--border-color, #e2e8f0);
          border-top-left-radius: 8px;
          border-bottom-left-radius: 8px;
        }
        .po-document-paper .custom-table thead th:last-child {
          border-right: 1px solid var(--border-color, #e2e8f0);
          border-top-right-radius: 8px;
          border-bottom-right-radius: 8px;
        }
        .po-document-paper .custom-table tbody td {
          padding: 8px;
          vertical-align: middle;
        }
        .custom-table select,
        .custom-table input {
          width: 100%;
          height: 32px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          background: var(--bg-primary, #f8fafc);
          color: var(--text-main, #0f172a);
          padding: 4px 8px;
          font-size: 12px;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        .custom-table select:focus,
        .custom-table input:focus {
          border-color: var(--accent-color, #6366f1);
          outline: none;
          box-shadow: 0 0 0 2px var(--accent-light, rgba(99, 102, 241, 0.08));
        }
        .custom-table .smart-dropdown input {
          height: 32px;
          padding: 4px 8px;
          font-size: 12px;
          border-radius: 6px;
        }
        .smart-dropdown input {
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid var(--border-color, #e2e8f0);
          background: var(--bg-primary, #f8fafc);
          color: var(--text-main, #0f172a);
          font-size: 14px;
          transition: all 0.2s;
        }
        .smart-dropdown input:focus {
          border-color: var(--accent-color, #6366f1);
          outline: none;
          box-shadow: 0 0 0 3px var(--accent-light, rgba(99, 102, 241, 0.08));
        }
        .paper-signatures {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          border-top: 1px solid var(--border-color, #e2e8f0);
          padding-top: 24px;
          margin-top: 36px;
          font-size: 11px;
          color: var(--text-muted, #64748b);
        }
        .sig-box {
          border: 1px solid var(--border-color, #e2e8f0);
          padding: 14px;
          border-radius: 12px;
          background: var(--bg-primary, #f8fafc);
          text-align: center;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.01);
        }
        .sig-line {
          height: 1px;
          border-bottom: 1px dashed var(--text-muted, #94a3b8);
          margin: 18px 0 8px 0;
          opacity: 0.7;
        }
      `}</style>

      <div className="Header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className="Title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '24px', fontWeight: '800' }}>
            <FileText size={28} style={{ color: 'var(--accent-color)' }} />
            Generate Purchase Order (PO)
          </h2>
          <p className="SubTitle" style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Issue purchase orders, calculate tax rates, map color shades, and download print-ready PDFs with QR scan entries.
          </p>
        </div>

        {/* Pill switcher for Create PO vs Track History */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
          <button
            type="button"
            className={`btn ${poViewMode === 'create' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setPoViewMode('create')}
            style={{
              padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', height: 'auto', minHeight: 'unset',
              color: poViewMode === 'create' ? '#fff' : 'var(--text-main)',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <PlusCircle size={16} /> Create PO
          </button>
          <button
            type="button"
            className={`btn ${poViewMode === 'history' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setPoViewMode('history')}
            style={{
              padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', height: 'auto', minHeight: 'unset',
              color: poViewMode === 'history' ? '#fff' : 'var(--text-main)',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <History size={16} /> Track History
          </button>
        </div>
      </div>

      {poViewMode === 'create' ? (
        <div className="po-split-layout">

          {/* LEFT SIDE: Tabbed editor blocks */}
          <div className="po-left-pane" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            <div className="panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.02), 0 8px 10px -6px rgba(0,0,0,0.02)' }}>
              <div className="step-tabs">
                <div
                  className={`step-tab ${leftActiveTab === 'specs' ? 'active' : ''}`}
                  onClick={() => setLeftActiveTab('specs')}
                >
                  <Briefcase size={14} /> Specs & Ref
                </div>
                <div
                  className={`step-tab ${leftActiveTab === 'supplier' ? 'active' : ''}`}
                  onClick={() => setLeftActiveTab('supplier')}
                >
                  <Truck size={14} /> Supplier Profile
                </div>
                <div
                  className={`step-tab ${leftActiveTab === 'verifications' ? 'active' : ''}`}
                  onClick={() => setLeftActiveTab('verifications')}
                >
                  <UserCheck size={14} /> Signatures & Notes
                </div>
              </div>

              {/* TAB 1: Specs & Ref */}
              {leftActiveTab === 'specs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <label className="FormLabel" style={{ display: 'block', marginBottom: '8px' }}>Purchase Order Mode</label>
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
                      <button
                        type="button"
                        className={`btn ${poMode === 'lot' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => handlePoModeChange('lot')}
                        style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', height: 'auto', minHeight: 'unset', color: poMode === 'lot' ? '#fff' : 'var(--text-color)' }}
                      >
                        Against Lot
                      </button>
                      <button
                        type="button"
                        className={`btn ${poMode === 'normal' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => handlePoModeChange('normal')}
                        style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', height: 'auto', minHeight: 'unset', color: poMode === 'normal' ? '#fff' : 'var(--text-color)' }}
                      >
                        Normal PO
                      </button>
                    </div>
                  </div>

                  <div className="po-grid-2">
                    {poMode === 'lot' && (
                      <div>
                        <label className="FormLabel">Approved Design (Lot)</label>
                        <SearchableDesignSelect
                          designs={approvedDesigns}
                          value={selectedDesignId}
                          onChange={handleDesignChange}
                          placeholder="-- Choose Approved Lot --"
                        />
                      </div>
                    )}

                    <div style={{ gridColumn: poMode === 'lot' ? 'span 1' : 'span 2' }}>
                      <label className="FormLabel">Vendor Profile</label>
                      <select
                        className="FilterSelect"
                        value={selectedVendorId}
                        onChange={e => handleVendorChange(e.target.value)}
                        style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                      >
                        <option value="">-- Choose Vendor --</option>
                        {vendors.map(v => (
                          <option key={v.id} value={String(v.id)}>{v.name} ({v.materialsJoined || 'Trims'})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="FormLabel">PO Reference Number *</label>
                    <div className="po-input-group">
                      <input
                        type="text"
                        className="form-input"
                        value={poNumber}
                        onChange={e => setPoNumber(e.target.value)}
                        style={{ flex: 1, borderRadius: '8px', fontWeight: '800', color: '#0f172a' }}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleRegeneratePoNumber}
                        style={{ padding: '0 12px', height: '40px', borderRadius: '8px' }}
                        title="Generate Fresh Unique Reference"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="po-grid-2">
                    <div>
                      <label className="FormLabel">Order Date *</label>
                      <input type="date" className="form-input" value={orderDate} onChange={e => setOrderDate(e.target.value)} style={{ borderRadius: '8px' }} required />
                    </div>
                    <div>
                      <label className="FormLabel">Order Time *</label>
                      <input type="time" className="form-input" value={orderTime} onChange={e => setOrderTime(e.target.value)} style={{ borderRadius: '8px' }} required />
                    </div>
                  </div>

                  <div className="po-grid-2">
                    <div>
                      <label className="FormLabel">Expected Date</label>
                      <input type="date" className="form-input" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} style={{ borderRadius: '8px' }} />
                    </div>
                    <div>
                      <label className="FormLabel">Expected Time</label>
                      <input type="time" className="form-input" value={expectedTime} onChange={e => setExpectedTime(e.target.value)} style={{ borderRadius: '8px' }} />
                    </div>
                  </div>

                  {leadHuman && (
                    <div style={{ fontSize: '12px', background: 'var(--accent-light)', padding: '6px 12px', borderRadius: '8px', color: 'var(--accent-color)', fontWeight: '600', alignSelf: 'start' }}>
                      Expected Lead Time: {leadHuman}
                    </div>
                  )}
                  {selectedDesignId && (
                    <div style={{ marginTop: '10px', borderTop: '1.5px solid var(--border-color, #e2e8f0)', paddingTop: '14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
                        📋 Design Lot Activity Log & Repeat History
                      </span>
                      {getDesignHistoryLogs().length === 0 ? (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No history logs found for this lot.
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                          {getDesignHistoryLogs().map((log, lIdx) => (
                            <div key={lIdx} style={{ fontSize: '11px', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-secondary, #f8fafc)', display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '800', color: 'var(--accent-color, #6366f1)', textTransform: 'uppercase', fontSize: '9px' }}>
                                  {log.action} {String(log.lotId) !== String(selectedDesignId) ? `(Lot #${log.lotId})` : ''}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{log.timestamp}</span>
                              </div>
                              <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{log.details}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>Operator: {log.actorName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Supplier Profile */}
              {leftActiveTab === 'supplier' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label className="FormLabel">Choose From Saved Vendor Profiles</label>
                    <select
                      className="FilterSelect"
                      value={selectedVendorId}
                      onChange={e => handleVendorChange(e.target.value)}
                      style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '8px' }}
                    >
                      <option value="">-- Choose Saved Vendor --</option>
                      {vendors.map(v => (
                        <option key={v.id} value={String(v.id)}>{v.name} ({v.materialsJoined || 'Trims'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="FormLabel">Supplier / Vendor Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter Supplier Name"
                      value={supplierName}
                      onChange={e => {
                        const val = e.target.value;
                        setSupplierName(val);
                        const matched = vendors.find(v => (v.name || '').toLowerCase() === val.trim().toLowerCase());
                        setSelectedVendorId(matched ? matched.id : '');
                      }}
                      style={{ borderRadius: '8px' }}
                      required
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      💡 This supplier name connects directly to the Live Paper Preview and Generated PDF PO Header.
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 3: Verifications & Remarks */}
              {leftActiveTab === 'verifications' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label className="FormLabel">Requisition Raised By *</label>
                    <SmartDropdown
                      value={requisitionRaisedBy}
                      onChange={setRequisitionRaisedBy}
                      options={savedRequisitionNames}
                      placeholder="Search or type raiser name..."
                      localStorageKey={LOCAL_STORAGE_KEYS.REQUISITION_NAMES}
                      onSaveToLocalStorage={refreshSavedNames}
                      required
                    />
                  </div>
                  <div>
                    <label className="FormLabel">Prepared By *</label>
                    <SmartDropdown
                      value={preparedBy}
                      onChange={setPreparedBy}
                      options={savedPreparedNames}
                      placeholder="Search or type preparer name..."
                      localStorageKey={LOCAL_STORAGE_KEYS.PREPARED_NAMES}
                      onSaveToLocalStorage={refreshSavedNames}
                      required
                    />
                  </div>
                  <div>
                    <label className="FormLabel">Authorized By (Approved By) *</label>
                    <SmartDropdown
                      value={approvedBy}
                      onChange={setApprovedBy}
                      options={savedApprovedNames}
                      placeholder="Search or type authorizer name..."
                      localStorageKey={LOCAL_STORAGE_KEYS.APPROVED_NAMES}
                      onSaveToLocalStorage={refreshSavedNames}
                      required
                    />
                  </div>
                  <div>
                    <label className="FormLabel">Remarks / Instructions</label>
                    <textarea
                      className="form-input"
                      placeholder="Type optional PO terms, remarks, notes here..."
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      style={{ width: '100%', height: '70px', padding: '10px 14px', resize: 'vertical', borderRadius: '8px' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    loadAvailablePONumbers();
                    setShowLoadDialog(true);
                  }}
                  style={{ flex: 1, height: '40px', borderRadius: '8px' }}
                >
                  <Search size={16} /> Load PO
                </button>
                <button
                  className="btn btn-danger"
                  onClick={resetForm}
                  style={{ height: '40px', padding: '0 16px', borderRadius: '8px' }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Live paper invoice sheet */}
          <div className="po-right-pane">

            <div className="po-document-paper">

              <div>
                {/* Paper Header */}
                <div className="paper-header">
                  <div>
                    <h4 className="paper-company-title">STITCHPRO PVT. LTD.</h4>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Purchase Order Document</span>
                  </div>
                  <div className="paper-po-badge">
                    {poNumber}
                  </div>
                </div>

                {/* Paper Metadata Grid */}
                <div className="paper-metadata-block">
                  <div className="paper-meta-col">
                    <div><strong>Order Date:</strong> {orderDate} {orderTime}</div>
                    {expectedDate && <div><strong>Expected:</strong> {expectedDate} {expectedTime}</div>}
                    {leadHuman && <div><strong>Lead Time:</strong> {leadHuman}</div>}
                  </div>
                  <div className="paper-meta-col" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '20px' }}>
                    <div><strong>Supplier:</strong> {supplierName || 'N/A'}</div>
                    {/* {supplierAddress && <div><strong>Address:</strong> {supplierAddress}</div>}
                    {supplierPhone && <div><strong>Contact:</strong> {supplierPhone}</div>} */}
                  </div>
                </div>
                {/* Toggle controls paper options */}
                <div className="paper-toggles-bar print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', background: 'var(--bg-primary, #f8fafc)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--accent-color, #6366f1)', textTransform: 'none', letterSpacing: 'normal' }}>Po Item Mapping</span>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', color: 'var(--text-main, #0f172a)', margin: 0 }}>
                      <input type="checkbox" checked={shadeEnabled} onChange={e => {
                        setShadeEnabled(e.target.checked);
                        setLocalStorageItem(LOCAL_STORAGE_KEYS.SHADE_ENABLED, e.target.checked);
                      }} style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
                      Shade
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', color: 'var(--text-main, #0f172a)', margin: 0 }}>
                      <input type="checkbox" checked={gstEnabled} onChange={e => {
                        setGstEnabled(e.target.checked);
                        setLocalStorageItem(LOCAL_STORAGE_KEYS.GST_ENABLED, e.target.checked);
                      }} style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
                      Tax (GST)
                    </label>
                    {gstEnabled && (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          {[12, 18, 28].map(p => (
                            <button
                              key={p}
                              type="button"
                              className={`preset-pill ${gstPercentage === p ? 'active' : ''}`}
                              onClick={() => {
                                setGstPercentage(p);
                                setLocalStorageItem(LOCAL_STORAGE_KEYS.GST_PERCENTAGE, p);
                              }}
                              style={{
                                padding: '2px 8px', fontSize: '10px', borderRadius: '10px', height: '22px', border: '1px solid var(--border-color)', cursor: 'pointer',
                                background: gstPercentage === p ? 'var(--accent-color, #6366f1)' : 'var(--bg-primary, #ffffff)',
                                color: gstPercentage === p ? '#ffffff' : 'var(--text-muted, #64748b)',
                                fontWeight: '700', display: 'flex', alignItems: 'center', transition: 'all 0.15s'
                              }}
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <input
                            type="number"
                            value={![12, 18, 28].includes(gstPercentage) ? gstPercentage : ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              const p = isNaN(val) ? 0 : val;
                              setGstPercentage(p);
                              setLocalStorageItem(LOCAL_STORAGE_KEYS.GST_PERCENTAGE, p);
                            }}
                            placeholder="Custom"
                            style={{
                              width: '68px',
                              height: '22px',
                              padding: '2px 6px',
                              fontSize: '11px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              textAlign: 'center',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-main)'
                            }}
                          />
                          <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Paper Items Table */}
                <div className="custom-table-container">
                  <table className="custom-table" style={{ background: 'transparent' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '130px' }}>Dept *</th>
                        <th>Description *</th>
                        {shadeEnabled && <th style={{ width: '120px' }}>Shade</th>}
                        <th style={{ width: '90px', textAlign: 'center' }}>UOM *</th>
                        <th style={{ width: '85px', textAlign: 'right' }}>Qty *</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>Rate (₹)</th>
                        <th style={{ width: '95px', textAlign: 'right' }}>Amount</th>
                        <th style={{ width: '36px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => {
                        const rowAmt = (+row.qty || 0) * (+row.rate || 0);

                        let dropdownOptions = [];
                        const designItems = (designs || []).flatMap(d => d.bom || []);

                        if (row.department) {
                          const deptLower = row.department.toLowerCase().trim();
                          const sheetItems = itemsByDept[row.department] || [];
                          const bomItems = designItems
                            .filter(item => (item.category || 'Trims').toLowerCase().trim() === deptLower)
                            .map(item => item.name);
                          const catItems = (materials || [])
                            .filter(m => (m.category || 'Trims').toLowerCase().trim() === deptLower)
                            .map(m => m.name);
                          dropdownOptions = [...sheetItems, ...bomItems, ...catItems];
                        } else {
                          const sheetItems = sheetRows.map(r => r.item).filter(Boolean);
                          const bomItems = designItems.map(item => item.name);
                          const catItems = (materials || []).map(m => m.name);
                          dropdownOptions = [...sheetItems, ...bomItems, ...catItems];
                        }

                        const cleanDropdownOptions = Array.from(new Set(dropdownOptions.filter(Boolean)));
                        const finalOptions = Array.from(new Set([...cleanDropdownOptions, ...savedDescriptions])).sort((a, b) => a.localeCompare(b));

                        return (
                          <tr key={idx}>
                            <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--text-muted)', padding: '8px' }}>{idx + 1}</td>
                            <td style={{ padding: '8px' }}>
                              <select
                                value={row.department}
                                onChange={e => {
                                  const newDept = e.target.value;
                                  const matchedRow = sheetRows.find(r => String(r.item).toLowerCase().trim() === String(row.description).toLowerCase().trim());
                                  const keepDescription = matchedRow && matchedRow.dept === newDept;
                                  updateRow(idx, { department: newDept, description: keepDescription ? row.description : "" });
                                }}
                                style={{ padding: '4px 6px', fontSize: '12px' }}
                              >
                                <option value="">Dept</option>
                                {departments.map(d => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                                <option value="Trims">Trims</option>
                                <option value="Fabric">Fabric</option>
                                <option value="Packaging">Packaging</option>
                              </select>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <SmartDropdown
                                value={row.description}
                                onChange={val => {
                                  const matchedRow = sheetRows.find(r => String(r.item).toLowerCase().trim() === String(val).toLowerCase().trim());
                                  const extraUpdate = {};
                                  if (matchedRow && matchedRow.dept) {
                                    extraUpdate.department = matchedRow.dept;
                                  }
                                  updateRow(idx, { description: val, ...extraUpdate });
                                  saveDescriptionWithDebounce(val);
                                }}
                                options={finalOptions}
                                placeholder="Type item..."
                                localStorageKey={LOCAL_STORAGE_KEYS.DESCRIPTIONS}
                                onSaveToLocalStorage={() => setSavedDescriptions(getLocalStorageItem(LOCAL_STORAGE_KEYS.DESCRIPTIONS, []))}
                                required
                              />
                            </td>
                            {shadeEnabled && (
                              <td style={{ padding: '8px' }}>
                                <SmartDropdown
                                  value={row.shade}
                                  onChange={val => {
                                    updateRow(idx, { shade: val });
                                    saveShadeWithDebounce(val);
                                  }}
                                  options={savedShades}
                                  placeholder="Color"
                                  localStorageKey={LOCAL_STORAGE_KEYS.SHADES}
                                  onSaveToLocalStorage={() => setSavedShades(getLocalStorageItem(LOCAL_STORAGE_KEYS.SHADES, []))}
                                />
                              </td>
                            )}
                            <td style={{ padding: '8px' }}>
                              <select
                                value={row.uom}
                                onChange={e => updateRow(idx, { uom: e.target.value })}
                                style={{ padding: '4px 6px', fontSize: '12px' }}
                              >
                                <option value="">UOM</option>
                                {UOM_OPTIONS.map(u => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <input
                                type="number"
                                value={row.qty || ""}
                                onChange={e => updateRow(idx, { qty: parseFloat(e.target.value) || 0 })}
                                style={{ textAlign: 'right', padding: '4px 6px', fontSize: '12px' }}
                                placeholder="0"
                                min="0"
                                required
                              />
                            </td>
                            <td style={{ padding: '8px' }}>
                              <input
                                type="number"
                                value={row.rate || ""}
                                onChange={e => updateRow(idx, { rate: parseFloat(e.target.value) || 0 })}
                                style={{ textAlign: 'right', padding: '4px 6px', fontSize: '12px' }}
                                placeholder="0.00"
                                min="0"
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-main)', fontSize: '12px', padding: '8px' }}>
                              ₹{fmtMoney(rowAmt)}
                            </td>
                            <td style={{ textAlign: 'center', padding: '8px' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => removeRow(idx)}
                                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--danger)' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <button
                  className="btn btn-secondary"
                  onClick={addRow}
                  style={{ border: '1.5px dashed var(--border-color)', background: 'none', width: '100%', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--accent-color)', marginTop: '10px', borderRadius: '8px', fontSize: '12px' }}
                >
                  <PlusCircle size={14} /> Add New PO Item
                </button>
              </div>

              <div>
                {/* Calculations & Signatures footer inside paper */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', borderTop: '2px solid var(--text-main)', paddingTop: '14px', marginTop: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dashed var(--border-color)' }}>
                      <span>Subtotal:</span>
                      <strong>₹{fmtMoney(totals.sub)}</strong>
                    </div>
                    {gstEnabled && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dashed var(--border-color)' }}>
                        <span>GST ({gstPercentage}%):</span>
                        <strong>₹{fmtMoney(totals.gstAmount)}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '15px', color: 'var(--accent-color)' }}>
                      <span>Grand Total:</span>
                      <strong style={{ fontSize: '17px', fontWeight: '800' }}>₹{fmtMoney(totals.grandTotal)}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowSupervisorDialog(true)}
                      disabled={isSubmitting}
                      style={{ width: '100%', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', borderRadius: '8px' }}
                    >
                      {isSubmitting ? 'Saving PO...' : <><CheckCircle size={16} /> Confirm & Save PO</>}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={handleDownloadPdfPreview}
                      style={{ width: '100%', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', borderRadius: '8px' }}
                    >
                      <Download size={14} /> PDF Preview
                    </button>
                  </div>
                </div>

                {/* Dynamic signatures drawn on paper */}
                <div className="paper-signatures">
                  <div className="sig-box">
                    <div>Raised By:</div>
                    <div style={{ color: 'var(--text-main)', fontWeight: '700', fontSize: '12px', marginTop: '4px' }}>{requisitionRaisedBy || '________'}</div>
                    <div className="sig-line"></div>
                    <div>Signature & Date</div>
                  </div>
                  <div className="sig-box">
                    <div>Prepared By:</div>
                    <div style={{ color: 'var(--text-main)', fontWeight: '700', fontSize: '12px', marginTop: '4px' }}>{preparedBy || '________'}</div>
                    <div className="sig-line"></div>
                    <div>Signature & Date</div>
                  </div>
                  <div className="sig-box">
                    <div>Approved By:</div>
                    <div style={{ color: 'var(--text-main)', fontWeight: '700', fontSize: '12px', marginTop: '4px' }}>{approvedBy || '________'}</div>
                    <div className="sig-line"></div>
                    <div>Signature & Date</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.02)', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                Purchase Order Issuance Logs
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Track, filter, download, or load previously generated purchase orders from the local MySQL database.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={fetchLivePOs}
                disabled={loadingLivePOs}
                style={{ height: '38px', borderRadius: '8px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}
                title="Refresh Live PO Records"
              >
                <RefreshCw size={14} className={loadingLivePOs ? 'spin' : ''} />
                <span>{loadingLivePOs ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              <select
                className="FilterSelect"
                value={poStatusFilter}
                onChange={e => setPoStatusFilter(e.target.value)}
                style={{ height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12.5px', padding: '0 10px', fontWeight: '600', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)' }}
              >
                <option value="all">All Statuses</option>
                <option value="pending approval">⏳ Pending Approval</option>
                <option value="completed">✔ Completed</option>
                <option value="partially received">📦 Partial Inward</option>
                <option value="sent to vendor">Sent to Vendor</option>
              </select>

              {(() => {
                const targetList = livePOs.length > 0 ? livePOs : (pos || []);
                const matSet = new Set(backendMaterialsList);
                targetList.forEach(po => {
                  if (po.items) {
                    try {
                      const itms = typeof po.items === 'string' ? JSON.parse(po.items) : po.items;
                      if (Array.isArray(itms)) {
                        itms.forEach(i => {
                          const n = (i.name || i.description || i.item || '').trim();
                          if (n) matSet.add(n);
                        });
                      }
                    } catch (_) { }
                  }
                });
                const uniqueMats = Array.from(matSet).filter(Boolean).sort();

                return (
                  <select
                    className="FilterSelect"
                    value={poMaterialFilter}
                    onChange={e => setPoMaterialFilter(e.target.value)}
                    style={{ height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12.5px', padding: '0 10px', fontWeight: '600', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', maxWidth: '180px' }}
                  >
                    <option value="all">🧵 All Materials</option>
                    {uniqueMats.map(mat => (
                      <option key={mat} value={mat}>{mat}</option>
                    ))}
                  </select>
                );
              })()}

              <div style={{ position: 'relative', width: '260px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Filter by Material, PO, Vendor..."
                  value={poSearchQuery}
                  onChange={e => setPoSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px', width: '100%', borderRadius: '8px', height: '38px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left', fontWeight: '800' }}>
                  <th style={{ padding: '12px 10px' }}>PO Reference</th>
                  <th style={{ padding: '12px 10px' }}>Date Issued</th>
                  <th style={{ padding: '12px 10px' }}>Vendor / Supplier</th>
                  <th style={{ padding: '12px 10px' }}>Design Lot</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Total Value</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistoryPOs.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}>No Purchase Order logs found</div>
                      <div style={{ fontSize: '11.5px' }}>No purchase orders match your filter criteria or search query.</div>
                    </td>
                  </tr>
                ) : (
                  paginatedHistoryPOs.map(po => {
                    const isPendingApproval = po.status === 'Pending Approval';
                    return (
                      <tr key={po.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}>
                        <td style={{ padding: '12px 10px', fontWeight: '700', color: 'var(--accent-color)' }}>{po.poNumber}</td>
                        <td style={{ padding: '12px 10px', color: 'var(--text-main)' }}>{po.date || 'N/A'}</td>
                        <td style={{ padding: '12px 10px', fontWeight: '600', color: 'var(--text-main)' }}>{po.vendorName || 'N/A'}</td>
                        <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>
                          {po.designName && po.designName !== 'Custom PO' ? (
                            <span className="badge" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                              {po.designName}
                            </span>
                          ) : (
                            <span style={{ fontStyle: 'italic' }}>General PO</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                          {currencySymbol}{fmtMoney(po.total)}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '800',
                            backgroundColor:
                              isPendingApproval
                                ? '#fef3c7'
                                : (po.status === 'Completed' || po.status === 'Received Done'
                                  ? 'rgba(16, 185, 129, 0.12)'
                                  : po.status === 'Partially Received'
                                    ? 'rgba(245, 158, 11, 0.12)'
                                    : 'rgba(99, 102, 241, 0.12)'),
                            color:
                              isPendingApproval
                                ? '#b45309'
                                : (po.status === 'Completed' || po.status === 'Received Done'
                                  ? '#10b981'
                                  : po.status === 'Partially Received'
                                    ? '#f59e0b'
                                    : 'var(--accent-color)'),
                            border: isPendingApproval ? '1px solid #fde68a' : 'none'
                          }}>
                            {isPendingApproval ? '⏳ Pending Approval' : (po.status || 'Sent to Vendor')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleLoadPOFromHistory(po.poNumber)}
                              style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', height: '26px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Load PO details into active editor"
                            >
                              <PlusCircle size={12} /> Load
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleDownloadPOFromHistory(po)}
                              style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', height: '26px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="Download Purchase Order PDF"
                            >
                              <Download size={12} /> PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={poHistoryPage}
            setPage={setPoHistoryPage}
            rpp={poHistoryRpp}
            setRpp={setPoHistoryRpp}
            totalItems={filteredHistoryPOs.length}
            rppOptions={[5, 10, 20, 50, 100]}
          />
        </div>
      )}

      {/* MODAL: Load PO Form Sheet dialog */}
      {showLoadDialog && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: '400px', borderRadius: '16px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Load Purchase Order</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowLoadDialog(false)} style={{ borderRadius: '50%', padding: '6px' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '16px 0' }}>
              <label className="FormLabel">Select from Generated POs</label>
              <select
                className="form-input"
                value={searchPoNumber}
                onChange={e => setSearchPoNumber(e.target.value)}
                style={{ width: '100%', marginBottom: '12px', borderRadius: '8px', padding: '8px 12px', border: '1.5px solid var(--border-color)', backgroundColor: '#fff' }}
              >
                <option value="">-- Choose PO --</option>
                {Array.from(new Set(availablePONumbers)).map((no, idx) => (
                  <option key={`${no}-${idx}`} value={no}>{no}</option>
                ))}
              </select>

              <div style={{ textAlign: 'center', margin: '4px 0 12px 0', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>— OR TYPE MANUALLY —</div>

              <label className="FormLabel">Enter PO Reference Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="PO-XXXXXX"
                value={searchPoNumber}
                onChange={e => setSearchPoNumber(e.target.value)}
                style={{ width: '100%', marginBottom: '10px', borderRadius: '8px' }}
              />
              {loadError && (
                <div style={{ color: 'var(--danger)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={14} /> {loadError}
                </div>
              )}
            </div>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowLoadDialog(false)} style={{ borderRadius: '8px' }}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleLoadPO}
                disabled={isLoadingPO}
                style={{ borderRadius: '8px' }}
              >
                {isLoadingPO ? 'Loading...' : 'Fetch PO Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm submission supervisor popup */}
      {showSupervisorDialog && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale" style={{ maxWidth: '420px', borderRadius: '16px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm PO Generation</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSupervisorDialog(false)} style={{ borderRadius: '50%', padding: '6px' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Please review the signature mappings. This will register the PO in the local MySQL database and prepare your printed pages.
              </p>

              <div>
                <label className="FormLabel">Requisition Raised By *</label>
                <input type="text" className="form-input" value={requisitionRaisedBy} disabled style={{ background: 'var(--bg-primary)', opacity: 0.7, borderRadius: '8px' }} />
              </div>

              <div>
                <label className="FormLabel">Prepared By *</label>
                <input type="text" className="form-input" value={preparedBy} disabled style={{ background: 'var(--bg-primary)', opacity: 0.7, borderRadius: '8px' }} />
              </div>

              <div>
                <label className="FormLabel">Authorized By *</label>
                <input type="text" className="form-input" value={approvedBy} disabled style={{ background: 'var(--bg-primary)', opacity: 0.7, borderRadius: '8px' }} />
              </div>
            </div>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowSupervisorDialog(false)} style={{ borderRadius: '8px' }}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
              >
                {isSubmitting ? 'Saving...' : <><CheckCircle size={16} /> Confirm Issue</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}