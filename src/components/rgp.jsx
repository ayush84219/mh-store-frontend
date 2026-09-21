import { getBackendUrl } from '../utils/api';
import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";

// MUST be your deployed /exec URL
const WEB_APP_URL =
  "";

// Enhanced QR code generation with multiple fallbacks
export const generateQRCode = async (url) => {
  const services = [
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`,
    `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=300&margin=4`,
    `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(url)}&chld=L|1`
  ];

  for (let serviceUrl of services) {
    try {
      console.log(`Trying QR service: ${serviceUrl}`);
      const response = await fetch(serviceUrl);
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.warn(`QR service failed: ${serviceUrl}`, e);
      continue;
    }
  }

  throw new Error('All QR code services are currently unavailable');
};

// Convert image URL to data URL with better error handling
const toDataURL = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(new Error("Canvas conversion failed: " + error.message));
      }
    };
    img.onerror = () => reject(new Error("Failed to load QR image"));
    img.src = src;
  });

function Emoji({ children, size = 18, mr = 0, ml = 0 }) {
  return (
    <span style={{ fontSize: size, lineHeight: 1, marginRight: mr, marginLeft: ml }}>
      {children}
    </span>
  );
}

const DEPT_OPTIONS = [
  "Cutting", "Stitching", "Finishing", "Quality", "Packing", "Store",
  "Knitting", "Weaving", "Dyeing", "Washing", "Bleaching", "Printing",
  "Embroidery", "Handwork", "Applique", "Fabric Store", "Accessories Store",
  "Sampling", "Pattern Making", "CAD", "Merchandising", "Production",
  "Maintenance", "Cutting Room", "Trimming", "Dispatch", "HR", "Accounts",
  "Admin", "Security", "jacket", "Other"
];

const UOM_OPTIONS = [
  "M", "CM", "MM", "KM", "IN", "FT", "YD", "MI", "ROLL", "BALE", "BUNDLE",
  "THAN", "PKT", "BOLT", "PIECE", "CUT", "KG", "GM", "MG", "TON", "LBS", "OZ",
  "PCS", "UNIT", "PAIR", "SET", "DOZEN", "GROSS", "REAM", "COUNT", "EA", "NO",
  "SQM", "SQCM", "SQFT", "SQIN", "SQYD", "ACRE", "HECTARE", "L", "ML", "CC",
  "M3", "GAL", "CBM", "HR", "MIN", "DAY", "WK", "MONTH", "YR", "CONE", "CARD",
  "SHEET", "SHT", "STRIP", "POLY", "BOX", "CARTON", "PACK", "TUBE", "SPOOL",
  "REEL", "BOBBIN", "HANK", "MTR", "COIL", "LOT", "KIT", "ASSY", "BAG", "SACK",
  "DRUM", "CAN", "JAR", "BOTTLE", "TIN", "CASE", "CRATE", "PALLET", "GARMENT",
  "SHIRT", "PANT", "DRESS", "JACKET", "SUIT", "LTR", "KG/L", "CANISTER", "OTHER"
];

const RGP_TYPES = ["Fabric", "Tools", "Machine", "Sample", "Other"];

// Prepared By & Authorized By Options
const PREPARED_BY_OPTIONS = [
  "RASHMI",

];

const AUTHORIZED_BY_OPTIONS = [
  "MOHIT SIR",
  "EA",
  "VARUN SIR",
  "SAHIL CA",

];

// Enhanced RGP PDF Generator - With Prepared By & Authorized By
export function generateRgpPDF({ payload, options = {} }) {
  const { qrEntryImage = null, qrReturnImage = null, qrGateImage = null, qrSide = 96 } = options;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "normal");
  doc.setLineWidth(0.6);

  const page = { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight(), m: 40, gap: 12 };
  const setSize = (s) => doc.setFontSize(s);
  const bold = () => doc.setFont(undefined, "bold");
  const normal = () => doc.setFont(undefined, "normal");
  const text = (t, x, y, opt = {}) => doc.text(String(t ?? ""), x, y, opt);
  const rtext = (t, x, y, opt = {}) => text(t, x, y, { align: "right", ...opt });
  const line = (x1, y1, x2, y2) => doc.line(x1, y1, x2, y2);
  const wrap = (str, w) => doc.splitTextToSize(String(str || ""), w);
  const roundRect = (x, y, w, h, r = 7, style = "S") =>
    doc.roundedRect ? doc.roundedRect(x, y, w, h, r, r, style) : doc.rect(x, y, w, h, style);

  const drawFrame = () => roundRect(16, 16, page.w - 32, page.h - 32, 8, "S");
  let y = page.m;

  const SIG_H = 92;
  const QR_TITLE_H = 18;
  const QR_SIDE = qrSide || 96;
  const BOTTOM_QR_H = QR_TITLE_H + 8 + QR_SIDE + 10;
  const RESERVED_BOTTOM = 18 + 8 + BOTTOM_QR_H + 12 + SIG_H + 8;

  const needSpace = (h, withHeader = false) => {
    const usableBottom = page.h - page.m - RESERVED_BOTTOM;
    if (y + h > usableBottom) {
      doc.addPage();
      drawFrame();
      y = page.m;
      if (withHeader) {
        setSize(13);
        bold();
        text("RETURNABLE GATE PASS", page.m, y);
        normal();
        line(page.m, y + 6, page.w - page.m, y + 6);
        y += 18;
      }
      return true;
    }
    return false;
  };

  drawFrame();
  setSize(20);
  bold();
  text("RETURNABLE GATE PASS", page.w / 2, y, { align: "center" });
  normal();
  line(page.m, y + 6, page.w - page.m, y + 6);
  y += 26;

  // TOP ROW
  (function topRow() {
    const innerW = page.w - 2 * page.m;
    const rRGP = 0.40, rParty = 0.25, rGate = 0.35;
    const wAvail = innerW - page.gap * 2;
    const wRGP = Math.floor(wAvail * rRGP);
    const wParty = Math.floor(wAvail * rParty);
    const wGate = wAvail - wRGP - wParty;

    const x1 = page.m;
    const x2 = x1 + wRGP + page.gap;
    const x3 = x2 + wParty + page.gap;

    const metaPad = 12, lblW = 92;
    const mRows = [
      ["RGP #", (payload.rgpNo || "").replace(/\s+/g, "")],
      ["Date", payload.date || ""],
      ["Type", payload.rgpType || ""],
      ...(payload.expectedReturnDate ? [["Exp. Return", payload.expectedReturnDate]] : []),
      ...(payload.vehicleNo ? [["Vehicle No", payload.vehicleNo]] : []),
    ];
    const metaH = 22 + mRows.length * 16 + 16;

    const partyPad = 12;
    const partyBodyW = wParty - partyPad * 2;
    const partyLines = [
      payload.vendor || "",
      ...wrap(payload.partyAddress || "", partyBodyW),
      ...(payload.partyPhone ? [`Phone: ${payload.partyPhone}`] : []),
      ...(payload.partyContact ? [`Contact: ${payload.partyContact}`] : []),
    ];
    const partyH = 22 + partyLines.filter(Boolean).length * 12 + 16;

    const gateH = QR_TITLE_H + 8 + QR_SIDE + 10;
    const blockH = Math.max(metaH, partyH, gateH);
    needSpace(blockH);

    roundRect(x1, y, wRGP, blockH, 7, "S");
    setSize(10);
    bold(); text("RGP DETAILS", x1 + 12, y + 14); normal();
    line(x1 + 12, y + 18, x1 + wRGP - 12, y + 18);
    let my = y + 30;
    mRows.forEach(([label, value]) => {
      bold(); text(`${label}:`, x1 + metaPad, my);
      normal(); text(value || "", x1 + metaPad + lblW, my, { maxWidth: wRGP - metaPad * 2 - lblW });
      my += 16;
    });

    roundRect(x2, y, wParty, blockH, 7, "S");
    setSize(10);
    bold(); text("PARTY / VENDOR", x2 + 12, y + 14); normal();
    line(x2 + 12, y + 18, x2 + wParty - 12, y + 18);
    let py = y + 30;
    partyLines.forEach((ln) => { if (ln) { text(ln, x2 + partyPad, py); py += 12; } });

    roundRect(x3, y, wGate, blockH, 7, "S");
    setSize(10);
    bold(); text("MATERIAL OUT — SCAN", x3 + 12, y + 14); normal();
    line(x3 + 12, y + 18, x3 + wGate - 12, y + 18);
    if (qrEntryImage) {
      const qx = x3 + 12 + (wGate - 24 - QR_SIDE) / 2;
      const qy = y + 18 + 10;
      try { doc.addImage(qrEntryImage, "PNG", qx, qy, QR_SIDE, QR_SIDE); } catch { }
    }

    y += blockH + 16;
  })();

  // ITEMS TABLE
  (function drawTable() {
    const x0 = page.m, innerW = page.w - 2 * page.m;
    setSize(10); normal();

    const rows = (payload.entries || []).map((r, i) => {
      const qty1 = (+r.qty1 || 0).toLocaleString();
      const qty2 = (+r.qty2 || 0).toLocaleString();
      const totalQty = (+r.qty1 || 0);
      return {
        ...r,
        _i: i + 1,
        _qty1Str: qty1,
        _qty2Str: qty2,
        _totalQty: totalQty,
        _totalQtyStr: totalQty.toLocaleString()
      };
    });

    const measureMax = (arr, key) => arr.reduce((m, r) => Math.max(m, doc.getTextWidth(String(r[key] || ""))), 0);

    const MIN = {
      line: 28, lotNo: 50, department: 80, description: 120,
      purpose: 70, uom: 45, qty1: 40, qty2: 40, totalQty: 45
    };

    const qty1W = Math.max(MIN.qty1, measureMax(rows, "_qty1Str") + 14);
    const qty2W = Math.max(MIN.qty2, measureMax(rows, "_qty2Str") + 14);
    const totalQtyW = Math.max(MIN.totalQty, measureMax(rows, "_totalQtyStr") + 16);
    const lotNoW = Math.max(MIN.lotNo, measureMax(rows, "lotNo") + 10);

    const lineW = MIN.line, depW = MIN.department, purposeW = MIN.purpose, uomW = MIN.uom;
    const used = lineW + lotNoW + depW + purposeW + uomW + qty1W + qty2W + totalQtyW;
    const descW = Math.max(MIN.description, innerW - used);
    const diff = innerW - (used + descW);
    const adjTotalQtyW = totalQtyW + diff;

    const cols = [
      { key: "line", title: "#", w: lineW, align: "right" },
      { key: "lotNo", title: "LOT NO.", w: lotNoW },
      { key: "department", title: "DEPARTMENT", w: depW },
      { key: "description", title: "DESCRIPTION", w: descW },
      { key: "purpose", title: "PURPOSE", w: purposeW },
      { key: "uom", title: "UOM", w: uomW, align: "center" },
      { key: "qty1", title: "QTY 1", w: qty1W, align: "right" },
      { key: "qty2", title: "BAGS", w: qty2W, align: "right" },
      { key: "totalQty", title: "T.QTY", w: adjTotalQtyW, align: "right" },
    ];
    const xs = [x0]; cols.forEach((c, i) => xs.push(xs[i] + c.w));

    const headerH = 26, baseH = 20;

    const drawHeader = () => {
      needSpace(headerH, true);
      doc.rect(x0, y, innerW, headerH);
      setSize(10); bold();
      cols.forEach((c, i) => {
        const cx = c.align === "right" ? xs[i + 1] - 6 : c.align === "center" ? (xs[i] + xs[i + 1]) / 2 : xs[i] + 6;
        const opt = c.align === "right" ? { align: "right" } : c.align === "center" ? { align: "center" } : {};
        text(c.title, cx, y + 17, opt);
        if (i > 0) line(xs[i], y, xs[i], y + headerH);
      });
      normal(); y += headerH;
    };

    const drawRow = (r, idx) => {
      const descLines = doc.splitTextToSize(r.itemDesc || r.description || "", cols[3].w - 8);
      const purposeLines = doc.splitTextToSize(r.purpose || "", cols[4].w - 8);
      const rowH = Math.max(baseH, Math.max(descLines.length, purposeLines.length) * 12 + 8);
      needSpace(rowH, true);
      doc.rect(x0, y, innerW, rowH);
      for (let i = 1; i < xs.length - 1; i++) line(xs[i], y, xs[i], y + rowH);
      const yy = y + 12;

      rtext(r._i, xs[1] - 6, yy);
      text(r.lotNo || "", xs[1] + 6, yy);
      text(r.department || "", xs[2] + 6, yy);
      descLines.forEach((ln, j) => text(ln, xs[3] + 6, yy + j * 12));
      purposeLines.forEach((ln, j) => text(ln, xs[4] + 6, yy + j * 12));
      text(r.uom || "", (xs[5] + xs[6]) / 2, yy, { align: "center" });
      rtext(r._qty1Str, xs[7] - 6, yy);
      rtext(r._qty2Str, xs[8] - 6, yy);
      rtext(r._totalQtyStr, xs[9] - 6, yy);
      y += rowH;
      return r._totalQty;
    };

    drawHeader();
    let totalQuantity = 0;
    rows.forEach((r, i) => { totalQuantity += drawRow(r, i); });

    const totalH = 26;
    needSpace(totalH, true);
    doc.rect(x0, y, innerW, totalH);
    line(xs[xs.length - 2], y, xs[xs.length - 2], y + totalH);
    setSize(11); bold();
    text("TOTAL QUANTITY", x0 + 8, y + 17);
    rtext(totalQuantity.toLocaleString(), xs[9] - 8, y + 17);
    normal(); y += totalH;
  })();

  // BOTTOM BLOCKS with Prepared By & Authorized By
  (function bottomBlocks() {
    const innerW = page.w - 2 * page.m;
    const colW = (innerW - page.gap * 2) / 3;
    const x1 = page.m, x2 = x1 + colW + page.gap, x3 = x2 + colW + page.gap;

    const sigTop = page.h - page.m - SIG_H;
    const blockTop = sigTop - 12 - BOTTOM_QR_H;

    // Left box: MATERIAL RETURN SCAN
    roundRect(x1, blockTop, colW, BOTTOM_QR_H, 7, "S");
    setSize(10);
    bold(); text("MATERIAL RETURN", x1 + 10, blockTop + 14); normal();
    line(x1 + 10, blockTop + 18, x1 + colW - 10, blockTop + 18);
    if (qrReturnImage) {
      const qx = x1 + 10 + (colW - 20 - QR_SIDE) / 2;
      const qy = blockTop + 18 + 10;
      try { doc.addImage(qrReturnImage, "PNG", qx, qy, QR_SIDE, QR_SIDE); } catch { }
    }

    // Center box: GATE ENTRY SCAN
    roundRect(x2, blockTop, colW, BOTTOM_QR_H, 7, "S");
    setSize(10);
    bold(); text("GATE ENTRY", x2 + 10, blockTop + 14); normal();
    line(x2 + 10, blockTop + 18, x2 + colW - 10, blockTop + 18);
    if (qrGateImage) {
      const qx = x2 + 10 + (colW - 20 - QR_SIDE) / 2;
      const qy = blockTop + 18 + 10;
      try { doc.addImage(qrGateImage, "PNG", qx, qy, QR_SIDE, QR_SIDE); } catch { }
    }

    // Right box: REMARKS
    roundRect(x3, blockTop, colW, BOTTOM_QR_H, 7, "S");
    setSize(10);
    bold(); text("REMARKS", x3 + 10, blockTop + 14); normal();
    line(x3 + 10, blockTop + 18, x3 + colW - 10, blockTop + 18);
    if (payload.remarks) {
      const remarkLines = wrap(payload.remarks, colW - 20);
      let ry = blockTop + 30;
      remarkLines.forEach((line) => {
        text(line, x3 + 10, ry);
        ry += 12;
      });
    }

    // Signatures with Prepared By & Authorized By
    [x1, x2, x3].forEach((x) => roundRect(x, sigTop, colW, SIG_H, 7, "S"));
    bold();
    text("PREPARED BY", x1 + 10, sigTop + 16);
    text("AUTHORIZED BY", x2 + 10, sigTop + 16);
    text("SECURITY", x3 + 10, sigTop + 16);
    normal();

    const writeSig = (x, showPrepared = false, showAuthorized = false) => {
      const baseY = sigTop + SIG_H - 26;
      text("Signature", x + 10, baseY - 10);
      line(x + 10, baseY - 8, x + colW - 10, baseY - 8);
      text("Name:", x + 10, baseY + 2);
      if (showPrepared && payload.preparedBy) text(payload.preparedBy, x + 46, baseY + 2);
      if (showAuthorized && payload.authorizedBy) text(payload.authorizedBy, x + 46, baseY + 2);
      text("Date:", x + 10, baseY + 14);
    };
    writeSig(x1, true, false); // Prepared By
    writeSig(x2, false, true); // Authorized By
    writeSig(x3, false, false); // Security
  })();

  return doc;
}

// Preview Modal Component
function PreviewModal({ payload, onClose, onConfirm, loading }) {
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);

  useEffect(() => {
    const generatePreview = () => {
      try {
        const previewPayload = {
          ...payload,
          rgpNo: payload.rgpNo === "(auto)" ? "RGP-PREVIEW-001" : payload.rgpNo
        };
        const doc = generateRgpPDF({ payload: previewPayload, options: { qrEntryImage: null, qrReturnImage: null, qrGateImage: null } });
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        setPreviewPdfUrl(pdfUrl);
        return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
      } catch (error) {
        console.error("Failed to generate preview:", error);
      }
    };
    generatePreview();
  }, [payload]);

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>
            <Emoji size={22} mr={8}>👁️</Emoji>
            Preview RGP Document
          </h2>
          <button onClick={onClose} style={modalStyles.closeButton} disabled={loading}>
            <Emoji size={18}>✕</Emoji>
          </button>
        </div>
        <div style={modalStyles.previewContainer}>
          {previewPdfUrl ? (
            <iframe src={previewPdfUrl} title="RGP Preview" style={modalStyles.previewFrame} />
          ) : (
            <div style={modalStyles.loadingPreview}>
              <Emoji size={40}>⏳</Emoji>
              <p>Generating preview...</p>
            </div>
          )}
        </div>
        <div style={modalStyles.footer}>
          <button onClick={onClose} style={modalStyles.cancelButton} disabled={loading}>
            <Emoji size={16} mr={6}>←</Emoji> Back to Edit
          </button>
          <button onClick={onConfirm} style={modalStyles.confirmButton} disabled={loading}>
            <Emoji size={16} mr={6}>{loading ? "⏳" : "✓"}</Emoji>
            {loading ? "Submitting..." : "Confirm & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
  },
  modal: {
    backgroundColor: 'white', borderRadius: '24px', width: '90%', maxWidth: '1200px',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden',
  },
  header: {
    padding: '28px 36px', backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { margin: 0, fontSize: '1.9rem', fontWeight: '700', color: '#00296b', display: 'flex', alignItems: 'center' },
  closeButton: {
    background: 'none', border: '2px solid #e2e8f0', borderRadius: '12px', width: '48px', height: '48px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    fontSize: '20px', transition: 'all 0.3s ease', color: '#64748b',
  },
  previewContainer: { flex: 1, padding: '28px', overflow: 'auto', backgroundColor: '#f1f5f9' },
  previewFrame: { width: '100%', height: '550px', border: 'none', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
  loadingPreview: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '550px', color: '#64748b' },
  footer: { padding: '28px 36px', backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: '20px' },
  cancelButton: {
    padding: '16px 32px', backgroundColor: 'white', color: '#4b5563', border: '2px solid #d1d5db',
    borderRadius: '14px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer',
    transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', fontFamily: 'inherit',
  },
  confirmButton: {
    padding: '16px 36px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white', border: 'none', borderRadius: '14px', fontSize: '1.1rem', fontWeight: '700',
    cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center',
    fontFamily: 'inherit', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.3)',
  },
};

export default function FabricRgpForm({ today = new Date(), onSubmit, onBack, prefilledRgpData = null, setPrefilledRgpData = null, currentUser = null }) {
  const toYMD = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const [form, setForm] = useState({
    rgpNo: "(auto)",
    date: toYMD(today),
    vendor: "",
    rgpType: "Fabric",
    department: "",
    purpose: "",
    itemDesc: "",
    qty: "",
    uom: "",
    entries: [],
    expectedReturnDate: "",
    vehicleNo: "",
    preparedBy: "",
    authorizedBy: "",
    remarks: "",
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [customRgpType, setCustomRgpType] = useState("");
  const [customDepartments, setCustomDepartments] = useState({});
  const [customUoms, setCustomUoms] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);

  // New states for Prepared By & Authorized By
  const [isPreparedByCustom, setIsPreparedByCustom] = useState(false);
  const [isAuthorizedByCustom, setIsAuthorizedByCustom] = useState(false);
  const [preparedByCustomValue, setPreparedByCustomValue] = useState("");
  const [authorizedByCustomValue, setAuthorizedByCustomValue] = useState("");

  // Multi-mode configuration
  const [rgpMode, setRgpMode] = useState("automatic"); // "automatic" or "manual"
  const [wizardStep, setWizardStep] = useState(1); // 1 = Lot Search, 2 = Config & Matrix, 3 = Details & Review

  const [zipHeaders, setZipHeaders] = useState([]);
  const [doriOrders, setDoriOrders] = useState([]);
  const [trimPOs, setTrimPOs] = useState([]);

  useEffect(() => {
    if (prefilledRgpData) {
      setRgpMode("manual");
      setForm((prev) => ({
        ...prev,
        rgpType: prefilledRgpData.rgpType || prev.rgpType,
        department: prefilledRgpData.department || prev.department,
        purpose: prefilledRgpData.purpose || prev.purpose,
        itemDesc: prefilledRgpData.itemDesc || prev.itemDesc,
        qty: prefilledRgpData.qty || prev.qty,
        uom: prefilledRgpData.uom || prev.uom,
        entries: prefilledRgpData.entries || prev.entries,
        preparedBy: currentUser?.name || prev.preparedBy
      }));
      if (setPrefilledRgpData) {
        setPrefilledRgpData(null);
      }
    }
  }, [prefilledRgpData, setPrefilledRgpData, currentUser]);

  // Prefill from previous RGP state
  const [oldRgpSearch, setOldRgpSearch] = useState("");
  const [fetchingOldRgp, setFetchingOldRgp] = useState(false);
  const [oldRgpError, setOldRgpError] = useState("");

  // Prefill from previous PO state
  const [oldPoSearch, setOldPoSearch] = useState("");
  const [fetchingOldPo, setFetchingOldPo] = useState(false);
  const [oldPoError, setOldPoError] = useState("");

  const handleFetchOldRgpDetails = async () => {
    const trimmed = oldRgpSearch.trim();
    if (!trimmed) return;
    setFetchingOldRgp(true);
    setOldRgpError("");
    try {
      const backendUrl = getBackendUrl();
      
      // 1. Try to fetch from the new dedicated RGP endpoint first
      let oldPayload = null;
      try {
        const res = await fetch(`${backendUrl}/api/rgp/${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const rgpData = await res.json();
          if (rgpData) {
            oldPayload = rgpData;
          }
        }
      } catch (err) {
        console.warn("Could not fetch RGP from dedicated table, falling back to scans:", err.message);
      }

      // 2. Fallback to scans if not found in dedicated rgp table
      if (!oldPayload) {
        const res = await fetch(`${backendUrl}/api/scans`);
        if (!res.ok) throw new Error("Failed to fetch scan logs");
        const scans = await res.json();
        const foundScan = scans.find(
          (s) =>
            s.scan_type === "rgp_entry" &&
            s.lot_number &&
            s.lot_number.toLowerCase().trim() === trimmed.toLowerCase()
        );
        if (!foundScan) {
          setOldRgpError("RGP not found in database.");
          return;
        }
        if (!foundScan.rgp_payload) {
          setOldRgpError("RGP found, but no saved payload data exists.");
          return;
        }
        oldPayload = typeof foundScan.rgp_payload === "string" 
          ? JSON.parse(foundScan.rgp_payload) 
          : foundScan.rgp_payload;
      }
      
      // Prefill form
      const oldEntries = Array.isArray(oldPayload.entries) ? oldPayload.entries : [];
      const mappedEntries = oldEntries.map((r, idx) => ({
        lotNo: r.lotNo || "N/A",
        itemDesc: r.itemDesc || "",
        qty1: r.qty1 !== undefined ? String(r.qty1) : "",
        qty2: r.qty2 !== undefined ? String(r.qty2) : "0",
        uom: r.uom || "PCS",
        department: r.department || "Stitching",
        purpose: r.purpose || "Stitching"
      }));

      setForm((prev) => ({
        ...prev,
        vendor: oldPayload.vendor || prev.vendor,
        rgpType: oldPayload.rgpType || prev.rgpType,
        department: oldPayload.department || prev.department,
        purpose: oldPayload.purpose || prev.purpose,
        itemDesc: oldPayload.itemDesc || prev.itemDesc,
        qty: oldPayload.qty || prev.qty,
        uom: oldPayload.uom || prev.uom,
        entries: mappedEntries,
        expectedReturnDate: oldPayload.expectedReturnDate || prev.expectedReturnDate,
        vehicleNo: oldPayload.vehicleNo || prev.vehicleNo,
        preparedBy: oldPayload.preparedBy || prev.preparedBy,
        authorizedBy: oldPayload.authorizedBy || prev.authorizedBy,
        remarks: oldPayload.remarks || prev.remarks,
      }));
      
      // Handle custom Prepared By option
      if (oldPayload.preparedBy) {
        const isDefaultPrep = PREPARED_BY_OPTIONS.map(x => x.toLowerCase()).includes(oldPayload.preparedBy.toLowerCase());
        if (!isDefaultPrep) {
          setIsPreparedByCustom(true);
          setPreparedByCustomValue(oldPayload.preparedBy);
        } else {
          setIsPreparedByCustom(false);
          setPreparedByCustomValue("");
        }
      }
      
      // Handle custom Authorized By option
      if (oldPayload.authorizedBy) {
        const isDefaultAuth = AUTHORIZED_BY_OPTIONS.map(x => x.toLowerCase()).includes(oldPayload.authorizedBy.toLowerCase());
        if (!isDefaultAuth) {
          setIsAuthorizedByCustom(true);
          setAuthorizedByCustomValue(oldPayload.authorizedBy);
        } else {
          setIsAuthorizedByCustom(false);
          setAuthorizedByCustomValue("");
        }
      }
      
      setOldRgpSearch("");
      alert("Old RGP details successfully loaded!");
    } catch (err) {
      console.error(err);
      setOldRgpError("Error fetching RGP data: " + err.message);
    } finally {
      setFetchingOldRgp(false);
    }
  };

  const handleFetchOldPoDetails = async () => {
    const trimmed = oldPoSearch.trim();
    if (!trimmed) return;
    setFetchingOldPo(true);
    setOldPoError("");
    try {
      const backendUrl = getBackendUrl();
      let foundPoDetails = null;
      let poType = ""; // "general", "zip", "dori"

      // 1. Try fetching from general POs (/api/pos/:poNumber)
      try {
        const res = await fetch(`${backendUrl}/api/pos/${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const po = await res.json();
          if (po) {
            foundPoDetails = po;
            poType = "general";
          }
        }
      } catch (err) {
        console.warn("Not found in general POs or error:", err.message);
      }

      // 2. Try fetching from Zip POs (cutting headers)
      if (!foundPoDetails) {
        try {
          const res = await fetch(`${backendUrl}/api/cutting-headers`);
          if (res.ok) {
            const headers = await res.json();
            const matchingHeader = headers.find(h => {
              if (!h.zip_payload) return false;
              try {
                const parsed = typeof h.zip_payload === 'string' ? JSON.parse(h.zip_payload) : h.zip_payload;
                return parsed.poNumber && parsed.poNumber.toLowerCase().trim() === trimmed.toLowerCase();
              } catch (_) {
                return false;
              }
            });
            if (matchingHeader) {
              foundPoDetails = typeof matchingHeader.zip_payload === 'string' 
                ? JSON.parse(matchingHeader.zip_payload) 
                : matchingHeader.zip_payload;
              poType = "zip";
            }
          }
        } catch (err) {
          console.warn("Not found in zip POs or error:", err.message);
        }
      }

      // 3. Try fetching from Dori POs (doori orders)
      if (!foundPoDetails) {
        try {
          const res = await fetch(`${backendUrl}/api/doori-orders`);
          if (res.ok) {
            const orders = await res.json();
            const matchingOrder = orders.find(o => 
              o.po_number && o.po_number.toLowerCase().trim() === trimmed.toLowerCase()
            );
            if (matchingOrder) {
              foundPoDetails = matchingOrder.dori_payload 
                ? (typeof matchingOrder.dori_payload === 'string' ? JSON.parse(matchingOrder.dori_payload) : matchingOrder.dori_payload)
                : matchingOrder;
              poType = "dori";
            }
          }
        } catch (err) {
          console.warn("Not found in doori POs or error:", err.message);
        }
      }

      if (!foundPoDetails) {
        setOldPoError("Purchase Order (PO) not found in database.");
        return;
      }

      // Prefill RGP form using PO details
      if (poType === "general") {
        const mappedEntries = (foundPoDetails.items || []).map((item) => ({
          lotNo: foundPoDetails.designName || foundPoDetails.poNumber || "N/A",
          itemDesc: item.description || item.item || "",
          qty1: String(item.qty || item.quantity || 0),
          qty2: "0",
          uom: item.uom || item.unit || "PCS",
          department: item.department || item.dept || "Store",
          purpose: "Issue under PO",
        }));

        setForm((prev) => ({
          ...prev,
          vendor: foundPoDetails.vendorName || prev.vendor,
          rgpType: "Tools",
          remarks: `Prefilled from Purchase Order #${foundPoDetails.poNumber}.`,
          entries: mappedEntries,
        }));
      } else if (poType === "zip" || poType === "dori") {
        const mappedEntries = [];
        if (foundPoDetails.zipSelections) {
          Object.entries(foundPoDetails.zipSelections).forEach(([color, selection]) => {
            if (selection && selection.trim() !== "" && selection !== "BLOCKED") {
              mappedEntries.push({
                lotNo: foundPoDetails.poNumber || "N/A",
                itemDesc: `${poType.toUpperCase()} Shade: ${color} (${selection})`,
                qty1: "0",
                qty2: "0",
                uom: "PCS",
                department: "Stitching",
                purpose: "Stitching/Finishing",
              });
            }
          });
        }

        setForm((prev) => ({
          ...prev,
          vendor: prev.vendor,
          rgpType: "Other",
          remarks: `Prefilled from ${poType.toUpperCase()} PO #${foundPoDetails.poNumber}.`,
          entries: mappedEntries,
        }));
      }

      setOldPoSearch("");
      alert(`PO details loaded into RGP form successfully!`);
    } catch (err) {
      console.error(err);
      setOldPoError("Error fetching PO data: " + err.message);
    } finally {
      setFetchingOldPo(false);
    }
  };

  const fetchNextRgpNo = async () => {
    let maxSeq = 0;
    try {
      const hostname = window.location.hostname;
      const res = await fetch(`${getBackendUrl()}/api/scans`);
      if (res.ok) {
        const scans = await res.json();
        scans.forEach((s) => {
          const lot = String(s.lot_number || "");
          if (lot.toUpperCase().startsWith("RGP-")) {
            const parts = lot.split("-");
            const seqStr = parts[parts.length - 1];
            const seq = parseInt(seqStr, 10);
            if (!isNaN(seq) && seq > maxSeq && seq < 10000) {
              maxSeq = seq;
            }
          }
        });
      }
    } catch (err) {
      console.warn("Failed to fetch scans for sequential RGP numbering:", err);
    }

    const localLast = localStorage.getItem("gpdms_last_rgp_seq");
    let localSeq = localLast ? parseInt(localLast, 10) : 0;
    if (isNaN(localSeq) || localSeq >= 10000) {
      localSeq = 0;
    }
    const finalSeq = Math.max(maxSeq, localSeq) + 1;

    const paddedSeq = String(finalSeq).padStart(6, "0");
    const nextNo = `RGP-${paddedSeq}`;

    setForm((f) => ({ ...f, rgpNo: nextNo }));
  };

  useEffect(() => {
    fetchNextRgpNo();
  }, []);

  // RGP live tracking states
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [trackerRgpNo, setTrackerRgpNo] = useState("");
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackerLogs, setTrackerLogs] = useState([]);
  const [trackerError, setTrackerError] = useState("");

  // States for search and matrix workflow
  const [searchLotNo, setSearchLotNo] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchedDesign, setSearchedDesign] = useState(null);
  const [searchedMatrix, setSearchedMatrix] = useState(null);
  const [selectedBomItem, setSelectedBomItem] = useState(null);
  const [qtyPerPiece, setQtyPerPiece] = useState("1");
  const [itemUom, setItemUom] = useState("PCS");
  const [itemDepartment, setItemDepartment] = useState("Stitching");
  const [itemBags, setItemBags] = useState("0");
  const [selectedMatrixRows, setSelectedMatrixRows] = useState(new Set());
  const [flatQuantity, setFlatQuantity] = useState("");
  const [flatDescription, setFlatDescription] = useState("");
  const [useMatrix, setUseMatrix] = useState(true);

  // States for custom entry fallback
  const [customItemLot, setCustomItemLot] = useState("");
  const [customItemDesc, setCustomItemDesc] = useState("");
  const [customItemQty, setCustomItemQty] = useState("");
  const [customItemUom, setCustomItemUom] = useState("PCS");
  const [customItemDept, setCustomItemDept] = useState("Store");
  const [customItemPurpose, setCustomItemPurpose] = useState("Stitching");
  const [customItemBags, setCustomItemBags] = useState("0");

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const fetchAllRgpHistory = async () => {
    setTrackerLoading(true);
    setTrackerError("");
    setTrackerLogs([]);
    try {
      const backendUrl = getBackendUrl();
      const [scansRes, zipRes, doriRes, posRes] = await Promise.all([
        fetch(`${backendUrl}/api/scans`),
        fetch(`${backendUrl}/api/cutting-headers`),
        fetch(`${backendUrl}/api/doori-orders`),
        fetch(`${backendUrl}/api/pos`)
      ]);
      
      const scansData = scansRes.ok ? await scansRes.json() : [];
      const zipsData = zipRes.ok ? await zipRes.json() : [];
      const dorisData = doriRes.ok ? await doriRes.json() : [];
      const posData = posRes.ok ? await posRes.json() : [];
      
      setZipHeaders(zipsData);
      setDoriOrders(dorisData);
      setTrimPOs(posData);
      
      const filtered = scansData.filter(
        (s) => s.lot_number && s.lot_number.trim() !== ''
      );
      
      filtered.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at));
      
      setTrackerLogs(filtered);
      if (filtered.length === 0) {
        setTrackerError("No scan records found in the database.");
      }
    } catch (err) {
      console.error("Tracker fetch all error:", err);
      setTrackerError("Could not retrieve history. Verify that backend is running.");
    } finally {
      setTrackerLoading(false);
    }
  };

  const fetchRgpTracking = async (rgpNoToSearch) => {
    const trimmed = (rgpNoToSearch || "").trim();
    if (!trimmed) {
      fetchAllRgpHistory();
      return;
    }
    setTrackerLoading(true);
    setTrackerError("");
    setTrackerLogs([]);
    try {
      const backendUrl = getBackendUrl();
      const [scansRes, zipRes, doriRes, posRes] = await Promise.all([
        fetch(`${backendUrl}/api/scans`),
        fetch(`${backendUrl}/api/cutting-headers`),
        fetch(`${backendUrl}/api/doori-orders`),
        fetch(`${backendUrl}/api/pos`)
      ]);
      
      const scansData = scansRes.ok ? await scansRes.json() : [];
      const zipsData = zipRes.ok ? await zipRes.json() : [];
      const dorisData = doriRes.ok ? await doriRes.json() : [];
      const posData = posRes.ok ? await posRes.json() : [];
      
      setZipHeaders(zipsData);
      setDoriOrders(dorisData);
      setTrimPOs(posData);
      
      const filtered = scansData.filter(
        (s) => (s.lot_number || "").trim().toLowerCase() === trimmed.toLowerCase()
      );
      
      filtered.sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at));
      
      setTrackerLogs(filtered);
      if (filtered.length === 0) {
        setTrackerError(`No scan records found for RGP: "${trimmed}". Please scan the printed QR code using mobile to record entries.`);
      }
    } catch (err) {
      console.error("Tracker fetch error:", err);
      setTrackerError("Could not retrieve tracking details. Verify that backend is running.");
    } finally {
      setTrackerLoading(false);
    }
  };

  useEffect(() => {
    if (showTrackerModal) {
      if (form.rgpNo && form.rgpNo !== "(auto)") {
        setTrackerRgpNo(form.rgpNo);
        fetchRgpTracking(form.rgpNo);
      } else {
        setTrackerRgpNo("");
        setTrackerLogs([]);
        setTrackerError("");
      }
    }
  }, [showTrackerModal]);

  const handleSearchLot = async () => {
    if (!searchLotNo.trim()) return;
    setSearchLoading(true);
    setSearchError("");
    setSearchedDesign(null);
    setSearchedMatrix(null);
    setSelectedBomItem(null);
    setSelectedMatrixRows(new Set());

    try {
      // 1. Fetch design/BOM requirements
      const designRes = await fetch(`${getBackendUrl()}/api/public/lot/${searchLotNo.trim()}`);
      let designData = null;
      if (designRes.ok) {
        designData = await designRes.json();

        // Enforce design approval check
        if (designData.status !== 'Approved') {
          setSearchError(`Design lot #${searchLotNo.trim()} is currently "${designData.status || 'Pending'}". It must be approved before creating an RGP.`);
          setSearchLoading(false);
          return;
        }

        setSearchedDesign(designData);
      } else {
        // Design not registered in system DB yet
        setSearchError(`Design lot #${searchLotNo.trim()} has not been created or approved in the system yet.`);
        setSearchLoading(false);
        return;
      }

      // 2. Fetch cutting matrix
      const cuttingRes = await fetch(`${getBackendUrl()}/api/cutting/${searchLotNo.trim()}`);
      if (cuttingRes.ok) {
        const cuttingData = await cuttingRes.json();
        setSearchedMatrix(cuttingData);
        if (cuttingData && cuttingData.rows && cuttingData.rows.length > 0) {
          const initialColors = new Set(cuttingData.rows.map(r => r.color));
          setSelectedMatrixRows(initialColors);
          setUseMatrix(true);
        } else {
          setUseMatrix(false);
        }
      } else {
        setUseMatrix(false);
      }

      if (designData) {
        setWizardStep(2);
        if (designData.bom && Array.isArray(designData.bom)) {
          const yesItems = designData.bom.filter(item => item.status && item.status.toLowerCase() === 'yes');
          if (yesItems.length > 0) {
            handleSelectBomItem(yesItems[0]);
          }
        }
      } else {
        setSearchError(`Lot number "${searchLotNo}" not found in database.`);
      }
    } catch (err) {
      console.error("Search error:", err);
      setSearchError("Failed to fetch Lot details. Make sure the backend server is running.");
    } finally {
      setSearchLoading(false);
    }
  };

  function handleSelectBomItem(item) {
    setSelectedBomItem(item);
    update("rgpType", item.name);

    const detailNum = parseFloat(item.detail);
    if (!isNaN(detailNum) && detailNum > 0) {
      setQtyPerPiece(String(detailNum));
    } else {
      setQtyPerPiece("1");
    }

    // Map UOM
    if (item.name.toLowerCase().includes("zip")) {
      setItemUom("PCS");
    } else if (item.name.toLowerCase().includes("button")) {
      setItemUom("PCS");
    } else {
      setItemUom("PCS");
    }
    setFlatDescription(item.description || item.name || "");
    setFlatQuantity("");
  }

  const handleAddMatrixRowsToRgp = () => {
    if (!searchedDesign || !selectedBomItem) return;

    const qtyMultiplier = parseFloat(qtyPerPiece) || 0;
    if (useMatrix && qtyMultiplier <= 0) {
      alert("Please enter a valid Quantity per piece (> 0).");
      return;
    }

    const rowsToAdd = [];

    if (useMatrix && searchedMatrix && searchedMatrix.rows && searchedMatrix.rows.length > 0) {
      searchedMatrix.rows.forEach(row => {
        if (selectedMatrixRows.has(row.color)) {
          const qty = (row.totalPcs || 0) * qtyMultiplier;
          if (qty > 0) {
            rowsToAdd.push({
              lotNo: searchedDesign.id,
              itemDesc: `${selectedBomItem.name} - ${row.color} (${row.totalPcs} pcs x ${qtyMultiplier})`,
              qty1: String(qty),
              qty2: itemBags || "0",
              uom: itemUom || "PCS",
              department: itemDepartment || form.department || "Stitching",
              purpose: form.purpose || "Stitching"
            });
          }
        }
      });
    } else {
      const qty = parseFloat(flatQuantity) || 0;
      if (qty <= 0) {
        alert("Please enter a valid manual quantity (> 0).");
        return;
      }
      rowsToAdd.push({
        lotNo: searchedDesign.id,
        itemDesc: `${selectedBomItem.name} ${flatDescription ? '- ' + flatDescription : ''}`.trim(),
        qty1: String(qty),
        qty2: itemBags || "0",
        uom: itemUom || "PCS",
        department: itemDepartment || form.department || "Stitching",
        purpose: form.purpose || "Stitching"
      });
    }

    if (rowsToAdd.length === 0) {
      alert("No items were generated. Make sure you selected at least one color row with pieces.");
      return;
    }

    setForm(f => {
      let currentEntries = [...(f.entries || [])];
      if (currentEntries.length === 1 && !currentEntries[0].lotNo && !currentEntries[0].itemDesc) {
        currentEntries = [];
      }
      return {
        ...f,
        entries: [...currentEntries, ...rowsToAdd]
      };
    });

    setSelectedBomItem(null);
    setFlatQuantity("");
    setFlatDescription("");
    setWizardStep(3);
  };

  const handleAddCustomItem = () => {
    if (!customItemDesc.trim()) {
      alert("Please enter a description for the custom item.");
      return;
    }
    const qty = parseFloat(customItemQty) || 0;
    if (qty <= 0) {
      alert("Please enter a valid quantity (> 0).");
      return;
    }
    if (!customItemUom) {
      alert("Please select a UOM.");
      return;
    }
    if (!customItemDept) {
      alert("Please select a Department.");
      return;
    }
    if (!customItemPurpose.trim()) {
      alert("Please enter a Purpose.");
      return;
    }

    const newEntry = {
      lotNo: customItemLot.trim() || "N/A",
      itemDesc: customItemDesc.trim(),
      qty1: String(qty),
      qty2: customItemBags || "0",
      uom: customItemUom,
      department: customItemDept,
      purpose: customItemPurpose.trim()
    };

    setForm(f => {
      let currentEntries = [...(f.entries || [])];
      if (currentEntries.length === 1 && !currentEntries[0].lotNo && !currentEntries[0].itemDesc) {
        currentEntries = [];
      }
      return {
        ...f,
        entries: [...currentEntries, newEntry]
      };
    });

    setCustomItemDesc("");
    setCustomItemQty("");
    setCustomItemBags("0");
  };

  useEffect(() => {
    if (selectedBomItem) {
      setItemDepartment("Stitching");
      setItemUom("PCS");
      setItemBags("0");
    }
  }, [selectedBomItem]);

  const removeRow = (idx) =>
    setForm((f) => {
      const entries = [...(f.entries || [])];
      entries.splice(idx, 1);
      return { ...f, entries };
    });

  const required = ["date", "vendor", "expectedReturnDate", "preparedBy", "authorizedBy"];

  const validate = () => {
    const e = {};
    required.forEach((k) => {
      let value = form[k];
      if (k === "preparedBy" && isPreparedByCustom) value = preparedByCustomValue;
      if (k === "authorizedBy" && isAuthorizedByCustom) value = authorizedByCustomValue;
      if (!String(value ?? "").trim()) e[k] = "Required";
    });

    const entries = form.entries || [];
    if (!entries.length) {
      e.entries = "At least one item row is required";
    } else {
      const rowErrs = entries.map((row) => {
        const re = {};
        const q1 = Number(row.qty1);
        const hasQ = (Number.isFinite(q1) && q1 > 0);
        if (!row.itemDesc && !row.lotNo) re.itemDesc = "Add Description or Lot No.";
        if (!row.uom) re.uom = "UOM required";
        if (!row.department) re.department = "Department required";
        if (!String(row.purpose || "").trim()) re.purpose = "Purpose required";
        if (!hasQ) re.qty = "Qty1 must be > 0";
        return re;
      });
      if (rowErrs.some((re) => Object.keys(re).length)) e.entries = rowErrs;
    }

    if (form.expectedReturnDate && form.date && form.expectedReturnDate < form.date)
      e.expectedReturnDate = "Cannot be before Issue Date";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const silentRefresh = () => {
    const formKey = 'rgp_form_backup_' + new Date().getTime();
    sessionStorage.setItem(formKey, JSON.stringify({ form, customRgpType, customDepartments, customUoms, isPreparedByCustom, isAuthorizedByCustom, preparedByCustomValue, authorizedByCustomValue }));
    setSubmissionComplete(true);
    setTimeout(() => {
      sessionStorage.removeItem(formKey);
      window.location.reload();
    }, 100);
  };

  useEffect(() => {
    const checkForBackup = () => {
      const keys = Object.keys(sessionStorage);
      const backupKey = keys.find(key => key.startsWith('rgp_form_backup_'));
      if (backupKey) {
        try {
          const backup = JSON.parse(sessionStorage.getItem(backupKey));
          if (backup) {
            setForm(backup.form);
            setCustomRgpType(backup.customRgpType);
            setCustomDepartments(backup.customDepartments);
            setCustomUoms(backup.customUoms);
            setIsPreparedByCustom(backup.isPreparedByCustom);
            setIsAuthorizedByCustom(backup.isAuthorizedByCustom);
            setPreparedByCustomValue(backup.preparedByCustomValue);
            setAuthorizedByCustomValue(backup.authorizedByCustomValue);
            setTimeout(() => alert("✅ Form submitted successfully! Data has been restored."), 500);
            sessionStorage.removeItem(backupKey);
          }
        } catch (error) {
          console.error("Failed to restore backup:", error);
          sessionStorage.removeItem(backupKey);
        }
      }
    };
    checkForBackup();
  }, []);

  const handlePreview = (e) => {
    e.preventDefault();
    if (!validate()) {
      alert("❌ Form is incomplete! Please check for missing fields and ensure you added at least one item row before previewing.");
      return;
    }
    setShowPreview(true);
  };

  const handleFinalSubmit = async () => {
    if (submitting) return;

    if (!validate()) {
      alert("❌ Form is incomplete! Please fill in all required fields and ensure you added at least one item row before saving.");
      return;
    }

    const first = (form.entries || [])[0] || {};
    const legacyQty = (Number(first.qty1) || 0) || "";
    const activeRgpType = rgpMode === "automatic" && selectedBomItem ? selectedBomItem.name : form.rgpType;
    const rgpTypeFinal = activeRgpType === "Other" ? customRgpType.trim() : activeRgpType;

    // Get final Prepared By and Authorized By values
    const finalPreparedBy = isPreparedByCustom ? preparedByCustomValue : form.preparedBy;
    const finalAuthorizedBy = isAuthorizedByCustom ? authorizedByCustomValue : form.authorizedBy;

    const payload = {
      date: form.date,
      vendor: form.vendor,
      rgpType: rgpTypeFinal,
      department: first.department || "",
      purpose: first.purpose || "",
      itemDesc: first.itemDesc || "",
      qty: legacyQty,
      uom: first.uom || "",
      entries: (form.entries || []).map((r) => ({
        lotNo: r.lotNo || "",
        itemDesc: r.itemDesc || "",
        qty1: r.qty1 ? Number(r.qty1) : "",
        qty2: r.qty2 ? Number(r.qty2) : "",
        uom: r.uom || "",
        department: r.department || "",
        purpose: r.purpose || "",
      })),
      expectedReturnDate: form.expectedReturnDate,
      vehicleNo: form.vehicleNo,
      preparedBy: finalPreparedBy,
      authorizedBy: finalAuthorizedBy,
      remarks: form.remarks,
      createdAt: new Date().toISOString(),
    };

    const saveRgpToDatabase = async (rgpNoVal) => {
      try {
        const finalPayload = { ...payload, rgpNo: rgpNoVal };
        const response = await fetch(`${getBackendUrl()}/api/rgp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalPayload)
        });
        if (!response.ok) {
          console.error("Failed to save RGP to rgp database:", await response.text());
        }
      } catch (err) {
        console.error("Failed to save RGP to rgp database:", err);
      }
    };

    setSubmitting(true);

    // Bypassing Google Sheets if WEB_APP_URL is empty
    if (!WEB_APP_URL || !WEB_APP_URL.includes("/exec")) {
      console.log("WEB_APP_URL is empty or invalid. Generating local RGP print and completing.");

      const localRgpNo = form.rgpNo && form.rgpNo !== "(auto)" ? form.rgpNo : "RGP-" + String(new Date().getTime()).slice(-6);

      if (localRgpNo.startsWith("RGP-")) {
        const parts = localRgpNo.split("-");
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq)) {
          localStorage.setItem("gpdms_last_rgp_seq", String(seq));
        }
      }

      const payloadWithNo = { ...payload, rgpNo: localRgpNo };

      // Save RGP number to scans database and dedicated rgp table
      await saveRgpToDatabase(localRgpNo);

      let localSystemUrl = `${window.location.origin}/`;
      const isLocalHostOrIP =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.startsWith('172.');

      if (isLocalHostOrIP) {
        let serverIp = window.location.hostname;
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
        localSystemUrl = `http://${serverIp}${port}/`;
      }

      const entryUrl = `${localSystemUrl}?action=rgpEntryForm&rgp=${encodeURIComponent(localRgpNo)}`;
      const returnUrl = `${localSystemUrl}?action=rgpReturnForm&rgp=${encodeURIComponent(localRgpNo)}`;
      const gateUrl = `${localSystemUrl}?action=gateForm&rgp=${encodeURIComponent(localRgpNo)}`;

      let entryQR, returnQR, gateQR;
      try { entryQR = await generateQRCode(entryUrl); } catch (qrError) { console.error("Failed to generate entry QR:", qrError); }
      try { returnQR = await generateQRCode(returnUrl); } catch (qrError) { console.error("Failed to generate return QR:", qrError); }
      try { gateQR = await generateQRCode(gateUrl); } catch (qrError) { console.error("Failed to generate gate QR:", qrError); }

      let entryQRDataUrl = entryQR, returnQRDataUrl = returnQR, gateQRDataUrl = gateQR;
      if (entryQR && entryQR.startsWith('blob:')) { try { entryQRDataUrl = await toDataURL(entryQR); } catch (error) { console.warn("Failed to convert entry QR to data URL:", error); } }
      if (returnQR && returnQR.startsWith('blob:')) { try { returnQRDataUrl = await toDataURL(returnQR); } catch (error) { console.warn("Failed to convert return QR to data URL:", error); } }
      if (gateQR && gateQR.startsWith('blob:')) { try { gateQRDataUrl = await toDataURL(gateQR); } catch (error) { console.warn("Failed to convert gate QR to data URL:", error); } }

      setForm((f) => ({ ...f, rgpNo: localRgpNo }));
      if (onSubmit) onSubmit(payloadWithNo);

      const pdfDoc = generateRgpPDF({ payload: payloadWithNo, options: { qrEntryImage: entryQRDataUrl, qrReturnImage: returnQRDataUrl, qrGateImage: gateQRDataUrl } });
      pdfDoc.save(`RGP-${localRgpNo}.pdf`);

      setShowPreview(false);
      alert(`✅ RGP PDF Generated Locally!\nPDF has been downloaded.`);
      setSubmitting(false);
      silentRefresh();
      return;
    }

    try {
      console.log("Submitting payload to:", WEB_APP_URL);

      const res = await fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "Accept": "application/json" },
        body: "data=" + encodeURIComponent(JSON.stringify(payload)),
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch (parseError) { throw new Error('Invalid response from server'); }

      if (!json.ok) throw new Error(json.error || "Save failed");

      const assignedRgpNo = json.rgpNo;
      console.log("RGP created successfully:", assignedRgpNo);

      let localSystemUrl = `${window.location.origin}/`;
      const isLocalHostOrIP =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.startsWith('172.');

      if (isLocalHostOrIP) {
        let serverIp = window.location.hostname;
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
        localSystemUrl = `http://${serverIp}${port}/`;
      }

      const entryUrl = `${localSystemUrl}?action=rgpEntryForm&rgp=${encodeURIComponent(assignedRgpNo)}`;
      const returnUrl = `${localSystemUrl}?action=rgpReturnForm&rgp=${encodeURIComponent(assignedRgpNo)}`;
      const gateUrl = `${localSystemUrl}?action=gateForm&rgp=${encodeURIComponent(assignedRgpNo)}`;

      let entryQR, returnQR, gateQR;
      try { entryQR = await generateQRCode(entryUrl); } catch (qrError) { console.error("Failed to generate entry QR:", qrError); }
      try { returnQR = await generateQRCode(returnUrl); } catch (qrError) { console.error("Failed to generate return QR:", qrError); }
      try { gateQR = await generateQRCode(gateUrl); } catch (qrError) { console.error("Failed to generate gate QR:", qrError); }

      let entryQRDataUrl = entryQR, returnQRDataUrl = returnQR, gateQRDataUrl = gateQR;
      if (entryQR && entryQR.startsWith('blob:')) { try { entryQRDataUrl = await toDataURL(entryQR); } catch (error) { console.warn("Failed to convert entry QR to data URL:", error); } }
      if (returnQR && returnQR.startsWith('blob:')) { try { returnQRDataUrl = await toDataURL(returnQR); } catch (error) { console.warn("Failed to convert return QR to data URL:", error); } }
      if (gateQR && gateQR.startsWith('blob:')) { try { gateQRDataUrl = await toDataURL(gateQR); } catch (error) { console.warn("Failed to convert gate QR to data URL:", error); } }

      setForm((f) => ({ ...f, rgpNo: assignedRgpNo }));
      if (onSubmit) onSubmit({ ...payload, rgpNo: assignedRgpNo });

      // Save RGP number to scans database and dedicated rgp table
      await saveRgpToDatabase(assignedRgpNo);

      const pdfDoc = generateRgpPDF({ payload: { ...payload, rgpNo: assignedRgpNo }, options: { qrEntryImage: entryQRDataUrl, qrReturnImage: returnQRDataUrl, qrGateImage: gateQRDataUrl } });
      const safeNo = assignedRgpNo.replace(/[^\w\-]+/g, "-");
      pdfDoc.save(`RGP-${safeNo}.pdf`);

      setShowPreview(false);
      alert(`✅ RGP Created Successfully!\nRGP No: ${assignedRgpNo}\nPDF has been downloaded.`);
      silentRefresh();

    } catch (err) {
      console.error("Submit error:", err);
      alert(`❌ Error: ${err.message}\n\nData was saved to sheet but PDF generation failed.`);
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm({
      rgpNo: "(auto)",
      date: toYMD(today),
      vendor: "",
      rgpType: "Fabric",
      department: "",
      purpose: "",
      itemDesc: "",
      qty: "",
      uom: "",
      entries: [],
      expectedReturnDate: "",
      vehicleNo: "",
      preparedBy: "",
      authorizedBy: "",
      remarks: "",
    });
    setErrors({});
    setCustomRgpType("");
    setCustomDepartments({});
    setCustomUoms({});
    setIsPreparedByCustom(false);
    setIsAuthorizedByCustom(false);
    setPreparedByCustomValue("");
    setAuthorizedByCustomValue("");

    // Reset wizard states
    setWizardStep(1);
    setSearchLotNo("");
    setSearchedDesign(null);
    setSearchedMatrix(null);
    setSelectedBomItem(null);
  };

  const handleBack = () => {
    if (typeof onBack === "function") return onBack();
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  };

  const handlePreparedByChange = (e) => {
    const value = e.target.value;
    if (value === "custom") {
      setIsPreparedByCustom(true);
      update("preparedBy", "");
    } else {
      setIsPreparedByCustom(false);
      update("preparedBy", value);
      setPreparedByCustomValue("");
    }
  };

  const handleAuthorizedByChange = (e) => {
    const value = e.target.value;
    if (value === "custom") {
      setIsAuthorizedByCustom(true);
      update("authorizedBy", "");
    } else {
      setIsAuthorizedByCustom(false);
      update("authorizedBy", value);
      setAuthorizedByCustomValue("");
    }
  };

  const handleDepartmentChange = (idx, value) => {
    updateEntry(idx, "department", value);
    if (value !== "Other") setCustomDepartments(prev => ({ ...prev, [idx]: "" }));
  };

  const handleUomChange = (idx, value) => {
    updateEntry(idx, "uom", value);
    if (value !== "Other") setCustomUoms(prev => ({ ...prev, [idx]: "" }));
  };

  // Calculate total quantity for display
  const totalQuantity = (form.entries || []).reduce((sum, entry) => sum + (Number(entry.qty1) || 0), 0);

  const renderLeftColumnDetails = () => (
    <>
      {/* Prefill from Old RGP or PO */}
      <div style={{
        backgroundColor: '#f0fdf4',
        border: '1px solid #10b981',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <Emoji size={18} mr={8}>🔄</Emoji>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#065f46' }}>Prefill Details</h4>
        </div>
        
        <p style={{ fontSize: '0.8rem', color: '#047857', margin: '0 0 12px 0' }}>
          Copy details from a previous RGP or Purchase Order (PO) to avoid manual typing.
        </p>

        {/* Row 1: RGP Search */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            value={oldRgpSearch}
            onChange={(e) => setOldRgpSearch(e.target.value)}
            placeholder="Enter old RGP (e.g. RGP-000001)"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1.5px solid #a7f3d0',
              fontSize: '14px',
              outline: 'none',
              backgroundColor: '#ffffff',
            }}
          />
          <button
            type="button"
            onClick={handleFetchOldRgpDetails}
            disabled={fetchingOldRgp}
            style={{
              padding: '0 16px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {fetchingOldRgp ? "Loading..." : "Prefill RGP"}
          </button>
        </div>
        {oldRgpError && (
          <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '10px', fontWeight: '500' }}>
            ⚠️ {oldRgpError}
          </div>
        )}

        {/* Row 2: PO Search */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={oldPoSearch}
            onChange={(e) => setOldPoSearch(e.target.value)}
            placeholder="Enter PO # (e.g. PO-83425 or ZIP-PO-0001)"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1.5px solid #a7f3d0',
              fontSize: '14px',
              outline: 'none',
              backgroundColor: '#ffffff',
            }}
          />
          <button
            type="button"
            onClick={handleFetchOldPoDetails}
            disabled={fetchingOldPo}
            style={{
              padding: '0 16px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {fetchingOldPo ? "Loading..." : "Prefill PO"}
          </button>
        </div>
        {oldPoError && (
          <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', fontWeight: '500' }}>
            ⚠️ {oldPoError}
          </div>
        )}
      </div>

      {/* Issue Details Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <Emoji size={18} mr={8}>📌</Emoji>
          <h3 style={styles.sectionTitle}>Issue Details</h3>
          <span style={styles.requiredBadge}>Required</span>
        </div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>RGP Number <span style={styles.requiredStar}>*</span></label>
            <input value={form.rgpNo} readOnly style={styles.inputReadonly} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Issue Date <span style={styles.requiredStar}>*</span></label>
            <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} style={errors.date ? styles.inputError : styles.input} />
            {errors.date && <span style={styles.errorText}>{errors.date}</span>}
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Vendor / Party <span style={styles.requiredStar}>*</span></label>
            <input value={form.vendor} onChange={(e) => update("vendor", e.target.value)} placeholder="Enter vendor or party name" style={errors.vendor ? styles.inputError : styles.input} />
            {errors.vendor && <span style={styles.errorText}>{errors.vendor}</span>}
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Expected Return Date <span style={styles.requiredStar}>*</span></label>
            <input type="date" value={form.expectedReturnDate} onChange={(e) => update("expectedReturnDate", e.target.value)} style={errors.expectedReturnDate ? styles.inputError : styles.input} />
            {errors.expectedReturnDate && <span style={styles.errorText}>{errors.expectedReturnDate}</span>}
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Vehicle Number</label>
            <input value={form.vehicleNo} onChange={(e) => update("vehicleNo", e.target.value)} placeholder="Optional - Vehicle registration" style={styles.input} />
          </div>
        </div>
      </div>

      {/* Authorization Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <Emoji size={18} mr={8}>✍️</Emoji>
          <h3 style={styles.sectionTitle}>Authorization</h3>
          <span style={styles.requiredBadge}>Required</span>
        </div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Prepared By <span style={styles.requiredStar}>*</span></label>
            <select value={isPreparedByCustom ? "custom" : form.preparedBy} onChange={handlePreparedByChange} style={errors.preparedBy ? styles.inputError : styles.input}>
              <option value="">Select Preparer</option>
              {PREPARED_BY_OPTIONS.map((option, idx) => (<option key={idx} value={option}>{option}</option>))}
              <option value="custom">+ Manual Entry</option>
            </select>
            {isPreparedByCustom && (<input type="text" placeholder="Name & designation" value={preparedByCustomValue} onChange={(e) => { setPreparedByCustomValue(e.target.value); update("preparedBy", e.target.value); }} style={{ ...styles.input, marginTop: '8px' }} />)}
            {errors.preparedBy && <span style={styles.errorText}>{errors.preparedBy}</span>}
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Authorized By <span style={styles.requiredStar}>*</span></label>
            <select value={isAuthorizedByCustom ? "custom" : form.authorizedBy} onChange={handleAuthorizedByChange} style={errors.authorizedBy ? styles.inputError : styles.input}>
              <option value="">Select Authorizer</option>
              {AUTHORIZED_BY_OPTIONS.map((option, idx) => (<option key={idx} value={option}>{option}</option>))}
              <option value="custom">+ Manual Entry</option>
            </select>
            {isAuthorizedByCustom && (<input type="text" placeholder="Name & designation" value={authorizedByCustomValue} onChange={(e) => { setAuthorizedByCustomValue(e.target.value); update("authorizedBy", e.target.value); }} style={{ ...styles.input, marginTop: '8px' }} />)}
            {errors.authorizedBy && <span style={styles.errorText}>{errors.authorizedBy}</span>}
          </div>
        </div>
      </div>

      {/* Remarks Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <Emoji size={18} mr={8}>💬</Emoji>
          <h3 style={styles.sectionTitle}>Remarks</h3>
        </div>
        <textarea value={form.remarks} onChange={(e) => update("remarks", e.target.value)} placeholder="Additional remarks or special instructions..." style={styles.textarea} rows="3" />
      </div>
    </>
  );

  // Render Helper: Add custom item form card
  const renderCustomItemCard = () => (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <Emoji size={18} mr={8}>🔧</Emoji>
        <h3 style={styles.sectionTitle}>Add Custom Item (Manual)</h3>
      </div>
      <div style={styles.matrixFormGrid}>
        <div style={styles.formGroupCompact}>
          <label style={styles.labelCompact}>Lot Number (Optional)</label>
          <input
            value={customItemLot}
            onChange={(e) => setCustomItemLot(e.target.value)}
            placeholder="e.g. 11028"
            style={styles.inputCompact}
          />
        </div>
        <div style={styles.formGroupCompact}>
          <label style={styles.labelCompact}>Description <span style={styles.requiredStar}>*</span></label>
          <input
            value={customItemDesc}
            onChange={(e) => setCustomItemDesc(e.target.value)}
            placeholder="Item description & details"
            style={styles.inputCompact}
          />
        </div>
        <div style={styles.formGroupCompact}>
          <label style={styles.labelCompact}>Quantity <span style={styles.requiredStar}>*</span></label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={customItemQty}
            onChange={(e) => setCustomItemQty(e.target.value)}
            placeholder="0.00"
            style={styles.inputCompact}
          />
        </div>
        <div style={styles.formGroupCompact}>
          <label style={styles.labelCompact}>UOM <span style={styles.requiredStar}>*</span></label>
          <select value={customItemUom} onChange={(e) => setCustomItemUom(e.target.value)} style={styles.inputCompact}>
            <option value="">Select UOM</option>
            {UOM_OPTIONS.map((u) => (<option key={u} value={u}>{u}</option>))}
          </select>
        </div>
        <div style={styles.formGroupCompact}>
          <label style={styles.labelCompact}>Department <span style={styles.requiredStar}>*</span></label>
          <select value={customItemDept} onChange={(e) => setCustomItemDept(e.target.value)} style={styles.inputCompact}>
            <option value="">Select Department</option>
            {DEPT_OPTIONS.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
        </div>
        <div style={styles.formGroupCompact}>
          <label style={styles.labelCompact}>Purpose <span style={styles.requiredStar}>*</span></label>
          <input
            value={customItemPurpose}
            onChange={(e) => setCustomItemPurpose(e.target.value)}
            placeholder="Purpose"
            style={styles.inputCompact}
          />
        </div>
        <div style={styles.formGroupCompact}>
          <label style={styles.labelCompact}>Bags / Packages</label>
          <input
            type="number"
            min="0"
            value={customItemBags}
            onChange={(e) => setCustomItemBags(e.target.value)}
            placeholder="0"
            style={styles.inputCompact}
          />
        </div>
      </div>
      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleAddCustomItem}
          style={styles.addButtonInline}
        >
          ➕ Add Custom Item to Gate Pass
        </button>
      </div>
    </div>
  );

  // Render Helper: RGP entries review panel
  const renderGatePassItemsListCard = () => (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <Emoji size={18} mr={8}>📋</Emoji>
        <h3 style={styles.sectionTitle}>Gate Pass Items List</h3>
        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>
          {(form.entries || []).filter(e => e.itemDesc || e.lotNo).length} items added
        </span>
      </div>

      <div style={styles.itemsContainer}>
        {(form.entries || []).filter(e => e.itemDesc || e.lotNo).length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', border: '2.5px dashed #cbd5e1', borderRadius: '16px' }}>
            <Emoji size={32} mr={0}>📦</Emoji>
            <p style={{ marginTop: '12px', fontSize: '0.95rem' }}>No items added to the gate pass yet. Use the search tool to add items.</p>
          </div>
        ) : (
          (form.entries || []).map((row, idx) => {
            if (!row.itemDesc && !row.lotNo) return null;
            return (
              <div key={idx} style={styles.itemCardReview}>
                <div style={styles.itemCardReviewAccent} />
                <div style={styles.itemCardReviewLeft}>
                  <div style={styles.itemCardReviewTitle}>
                    <strong>{row.itemDesc || "No description"}</strong>
                  </div>
                  <div style={styles.itemCardReviewMeta}>
                    {row.lotNo && (
                      <span style={styles.metaBadgeLot}>
                        🏷️ Lot: <strong>{row.lotNo}</strong>
                      </span>
                    )}
                    <span style={styles.metaBadgeDept}>
                      🏢 Dept: <strong>{row.department}</strong>
                    </span>
                    <span style={styles.metaBadgePurpose}>
                      ⚙️ Purpose: <strong>{row.purpose}</strong>
                    </span>
                  </div>
                </div>
                <div style={styles.itemCardReviewRight}>
                  <div style={styles.itemCardReviewQtyBadge}>
                    <span style={styles.itemCardReviewQtyValue}>{(Number(row.qty1) || 0).toLocaleString()}</span>
                    <span style={styles.itemCardReviewQtyUom}>{row.uom}</span>
                  </div>
                  {Number(row.qty2) > 0 && (
                    <span style={styles.itemCardReviewBags}>
                      📦 {row.qty2} bags
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    style={styles.removeButtonReview}
                    title="Remove item"
                  >
                    <Emoji size={14}>🗑️</Emoji>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary Bar */}
      <div style={styles.summaryBar}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Total Items</span>
          <span style={styles.summaryValue}>{(form.entries || []).filter(e => e.itemDesc || e.lotNo).length}</span>
        </div>
        <div style={styles.summaryDivider}>|</div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Total Quantity</span>
          <span style={styles.summaryValue}>{totalQuantity.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );

  // Render Helper: Step 1 (Lot Search)
  const renderLotSearchStepCard = () => (
    <div style={styles.wizardSearchCard}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Emoji size={48} mr={0}>🔍</Emoji>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#0f2b3d', marginTop: '12px', marginBottom: '8px' }}>
          Begin Automatic RGP
        </h2>
        <p style={{ fontSize: '0.95rem', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
          Enter a style or production lot number to automatically load BOM accessories requirements & cutting sizes.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Enter Lot Number (e.g. 11028)"
            value={searchLotNo}
            onChange={(e) => setSearchLotNo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchLot(); } }}
            style={{ ...styles.input, fontSize: '1.1rem', padding: '14px 18px' }}
          />
        </div>
        <button
          type="button"
          onClick={handleSearchLot}
          disabled={searchLoading}
          style={{ ...styles.searchButton, padding: '0 28px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {searchLoading ? "Loading..." : (
            <>
              <Emoji size={16} mr={0}>🔍</Emoji>
              Search
            </>
          )}
        </button>
      </div>

      {searchError && (
        <div style={{ ...styles.errorAlert, marginTop: '20px', marginBottom: 0 }}>
          <Emoji size={14} mr={6}>⚠️</Emoji>
          {searchError}
        </div>
      )}
    </div>
  );

  // Render Helper: Step 2 Left (Lot summary & BOM selector)
  const renderLotSummaryAndBomPillsCard = () => (
    <div style={styles.section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => { setWizardStep(1); }}
          style={styles.wizardBackButton}
        >
          ← Back to Search
        </button>
        {(form.entries || []).length > 0 && (
          <button
            type="button"
            onClick={() => { setWizardStep(3); }}
            style={styles.wizardForwardButton}
          >
            Go to Details →
          </button>
        )}
      </div>

      <div style={styles.designSummaryCard}>
        <div style={{ borderBottom: '1.5px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f2b3d' }}>
            Lot: {searchedDesign.id}
          </div>
          {searchedDesign.style && (
            <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '4px' }}>
              Style: <strong>{searchedDesign.style}</strong>
            </div>
          )}
          {searchedDesign.category && (
            <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '2px' }}>
              Category: <strong>{searchedDesign.category}</strong>
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Choose One of BOM Details:
          </div>
          {searchedDesign.bom && searchedDesign.bom.filter(item => item.status && item.status.toLowerCase() === 'yes').length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {searchedDesign.bom.filter(item => item.status && item.status.toLowerCase() === 'yes').map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectBomItem(item)}
                  className="bom-pill"
                  style={{
                    ...styles.bomPill,
                    ...(selectedBomItem?.name === item.name ? styles.bomPillActive : {})
                  }}
                >
                  {item.name} {item.detail ? `(${item.detail})` : ''}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
              No BOM accessory requirements found. Use direct entry on the right.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render Helper: Step 2 Right (Accessory Matrix Config)
  const renderAccessoryConfigAndMatrixCard = () => (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <Emoji size={18} mr={8}>⚙️</Emoji>
        <h3 style={styles.sectionTitle}>Configure Issue: {selectedBomItem.name}</h3>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600' }}>
          <input
            type="radio"
            name="issue_mode"
            checked={useMatrix}
            onChange={() => setUseMatrix(true)}
            disabled={!searchedMatrix || !searchedMatrix.rows || searchedMatrix.rows.length === 0}
          />
          Per Piece (Using Cutting Matrix)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600' }}>
          <input
            type="radio"
            name="issue_mode"
            checked={!useMatrix}
            onChange={() => setUseMatrix(false)}
          />
          Manual / Flat Quantity
        </label>
      </div>

      {useMatrix ? (
        <div>
          {/* Matrix Row Inputs */}
          <div style={styles.matrixFormGrid}>
            <div style={styles.formGroupCompact}>
              <label style={styles.labelCompact}>Qty Per Piece <span style={styles.requiredStar}>*</span></label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={qtyPerPiece}
                onChange={(e) => setQtyPerPiece(e.target.value)}
                style={styles.inputCompact}
              />
            </div>
            <div style={styles.formGroupCompact}>
              <label style={styles.labelCompact}>UOM <span style={styles.requiredStar}>*</span></label>
              <select value={itemUom} onChange={(e) => setItemUom(e.target.value)} style={styles.inputCompact}>
                {UOM_OPTIONS.map((u) => (<option key={u} value={u}>{u}</option>))}
              </select>
            </div>
            <div style={styles.formGroupCompact}>
              <label style={styles.labelCompact}>Department <span style={styles.requiredStar}>*</span></label>
              <select value={itemDepartment} onChange={(e) => setItemDepartment(e.target.value)} style={styles.inputCompact}>
                <option value="">Select Department</option>
                {DEPT_OPTIONS.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </div>
            <div style={styles.formGroupCompact}>
              <label style={styles.labelCompact}>Bags / Packages</label>
              <input
                type="number"
                min="0"
                value={itemBags}
                onChange={(e) => setItemBags(e.target.value)}
                style={styles.inputCompact}
              />
            </div>
          </div>

          {/* Cutting Matrix Table */}
          {searchedMatrix && searchedMatrix.rows && searchedMatrix.rows.length > 0 && (
            <div style={{ marginTop: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <table className="matrixTable" style={styles.matrixTable}>
                <thead>
                  <tr style={styles.matrixTableHeaderRow}>
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedMatrixRows.size === searchedMatrix.rows.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMatrixRows(new Set(searchedMatrix.rows.map(r => r.color)));
                          } else {
                            setSelectedMatrixRows(new Set());
                          }
                        }}
                      />
                    </th>
                    <th>Color</th>
                    <th style={{ textAlign: 'right' }}>Table</th>
                    <th style={{ textAlign: 'right' }}>M</th>
                    <th style={{ textAlign: 'right' }}>L</th>
                    <th style={{ textAlign: 'right' }}>XL</th>
                    <th style={{ textAlign: 'right' }}>XXL</th>
                    <th style={{ textAlign: 'right' }}>Pcs</th>
                    <th style={{ textAlign: 'right', fontWeight: 'bold', color: '#0f2b3d' }}>Req Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {searchedMatrix.rows.map((row, idx) => {
                    const calculated = (row.totalPcs || 0) * (parseFloat(qtyPerPiece) || 0);
                    return (
                      <tr key={idx} style={styles.matrixTableRow}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedMatrixRows.has(row.color)}
                            onChange={(e) => {
                              const newSet = new Set(selectedMatrixRows);
                              if (e.target.checked) newSet.add(row.color);
                              else newSet.delete(row.color);
                              setSelectedMatrixRows(newSet);
                            }}
                          />
                        </td>
                        <td><strong>{row.color}</strong></td>
                        <td style={{ textAlign: 'right' }}>{row.cuttingTable ?? '-'}</td>
                        <td style={{ textAlign: 'right' }}>{row.sizes?.M ?? 0}</td>
                        <td style={{ textAlign: 'right' }}>{row.sizes?.L ?? 0}</td>
                        <td style={{ textAlign: 'right' }}>{row.sizes?.XL ?? 0}</td>
                        <td style={{ textAlign: 'right' }}>{row.sizes?.XXL ?? 0}</td>
                        <td style={{ textAlign: 'right' }}><strong>{row.totalPcs ?? 0}</strong></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>{calculated.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleAddMatrixRowsToRgp}
              style={styles.addButtonInline}
            >
              ➕ Add Selected Matrix Rows to Gate Pass
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Manual entry panel */}
          <div style={styles.matrixFormGrid}>
            <div style={styles.formGroupCompact}>
              <label style={styles.labelCompact}>Description / Detail</label>
              <input
                value={flatDescription}
                onChange={(e) => setFlatDescription(e.target.value)}
                placeholder="e.g. YKK Brass Zippers"
                style={styles.inputCompact}
              />
            </div>
            <div style={styles.formGroupCompact}>
              <label style={styles.labelCompact}>Manual Quantity <span style={styles.requiredStar}>*</span></label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={flatQuantity}
                onChange={(e) => setFlatQuantity(e.target.value)}
                placeholder="0.00"
                style={styles.inputCompact}
              />
            </div>
            <div style={styles.formGroupCompact}>
              <label style={styles.labelCompact}>UOM <span style={styles.requiredStar}>*</span></label>
              <select value={itemUom} onChange={(e) => setItemUom(e.target.value)} style={styles.inputCompact}>
                {UOM_OPTIONS.map((u) => (<option key={u} value={u}>{u}</option>))}
              </select>
            </div>
            <div style={styles.formGroupCompact}>
              <label style={styles.labelCompact}>Department <span style={styles.requiredStar}>*</span></label>
              <select value={itemDepartment} onChange={(e) => setItemDepartment(e.target.value)} style={styles.inputCompact}>
                <option value="">Select Department</option>
                {DEPT_OPTIONS.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </div>
            <div style={styles.formGroupCompact}>
              <label style={styles.labelCompact}>Bags / Packages</label>
              <input
                type="number"
                min="0"
                value={itemBags}
                onChange={(e) => setItemBags(e.target.value)}
                style={styles.inputCompact}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleAddMatrixRowsToRgp}
              style={styles.addButtonInline}
            >
              ➕ Add Manual Item to Gate Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Render Helper: Wizard Step indicator bar
  const renderWizardStepsIndicator = () => {
    const steps = [
      { num: 1, label: "Search Lot" },
      { num: 2, label: "Select BOM & Matrix" },
      { num: 3, label: "Fill Details & Review" }
    ];

    return (
      <div style={styles.wizardIndicatorContainer}>
        {steps.map((s, idx) => (
          <React.Fragment key={s.num}>
            <div
              style={{
                ...styles.wizardStepNode,
                ...(wizardStep === s.num ? styles.wizardStepNodeActive : {}),
                ...(wizardStep > s.num ? styles.wizardStepNodeCompleted : {})
              }}
              onClick={() => {
                if (searchedDesign || s.num === 1) {
                  setWizardStep(s.num);
                }
              }}
            >
              <div
                style={{
                  ...styles.wizardStepNodeNum,
                  ...(wizardStep === s.num ? styles.wizardStepNodeNumActive : {}),
                  ...(wizardStep > s.num ? styles.wizardStepNodeNumCompleted : {})
                }}
              >
                {wizardStep > s.num ? "✓" : s.num}
              </div>
              <div style={styles.wizardStepNodeLabel}>{s.label}</div>
            </div>
            {idx < steps.length - 1 && (
              <div
                style={{
                  ...styles.wizardStepLine,
                  ...(wizardStep > s.num ? styles.wizardStepLineCompleted : {})
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderTrackerModal = () => {
    // Group scans by RGP number
    const rgpGroups = {};
    trackerLogs.forEach((log) => {
      const rgpNo = log.lot_number || "Unknown";
      if (!rgpGroups[rgpNo]) {
        rgpGroups[rgpNo] = {
          rgpNo: rgpNo,
          gateEntry: null,
          materialIn: null,
          rgpEntry: null,
          rgpReturn: null,
          materialName: log.material_name || "—",
          quantity: log.quantity || "—",
          supplierName: log.supplier_name || "—",
          firstScanDate: log.scanned_at,
          allScans: []
        };
      }

      rgpGroups[rgpNo].allScans.push(log);

      if (log.scan_type === 'gate_entry') {
        rgpGroups[rgpNo].gateEntry = log;
      } else if (log.scan_type === 'material_in') {
        rgpGroups[rgpNo].materialIn = log;
      } else if (log.scan_type === 'rgp_entry') {
        rgpGroups[rgpNo].rgpEntry = log;
        rgpGroups[rgpNo].materialName = log.material_name;
        rgpGroups[rgpNo].quantity = log.quantity;
        rgpGroups[rgpNo].supplierName = log.supplier_name;
      } else if (log.scan_type === 'rgp_return') {
        rgpGroups[rgpNo].rgpReturn = log;
        rgpGroups[rgpNo].materialName = log.material_name;
        rgpGroups[rgpNo].quantity = log.quantity;
        rgpGroups[rgpNo].supplierName = log.supplier_name;
      }
    });

    const rgpRows = Object.values(rgpGroups);
    rgpRows.sort((a, b) => new Date(b.firstScanDate) - new Date(a.firstScanDate));

    return (
      <div style={modalStyles.overlay}>
        <div style={{ ...modalStyles.modal, maxWidth: '1200px', backgroundColor: '#0f172a', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ ...modalStyles.header, backgroundColor: 'rgba(15,23,42,0.8)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '20px 28px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Emoji size={24} mr={0}>🔍</Emoji> RGP Live Tracking & Status
            </h2>
            <button
              type="button"
              onClick={() => setShowTrackerModal(false)}
              style={{
                background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.8rem', cursor: 'pointer', fontWeight: 'bold', lineHeight: 1
              }}
            >
              ×
            </button>
          </div>

          <div style={{ padding: '24px', overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
            {/* Search bar */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
              <input
                type="text"
                placeholder="Enter RGP number (e.g. RGP-75649)"
                value={trackerRgpNo}
                onChange={(e) => setTrackerRgpNo(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchRgpTracking(trackerRgpNo); }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1.5px solid rgba(255,255,255,0.1)',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  color: '#f8fafc',
                  fontSize: '14px'
                }}
              />
              <button
                type="button"
                onClick={() => fetchRgpTracking(trackerRgpNo)}
                disabled={trackerLoading}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0 20px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
              >
                {trackerLoading ? "Loading..." : "Track"}
              </button>
              <button
                type="button"
                onClick={fetchAllRgpHistory}
                disabled={trackerLoading}
                style={{
                  backgroundColor: '#475569',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0 20px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  whiteSpace: 'nowrap'
                }}
              >
                📋 See All History
              </button>
            </div>

            {/* Loading or Error */}
            {trackerLoading && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
                <Emoji size={28}>⏳</Emoji> Searching scan records...
              </div>
            )}

            {trackerError && !trackerLoading && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#fca5a5',
                fontSize: '13px',
                lineHeight: 1.5,
                marginBottom: '20px'
              }}>
                ⚠️ {trackerError}
              </div>
            )}

            {/* Grouped Logs Table */}
            {!trackerLoading && rgpRows.length > 0 && (
              <div style={{ overflowX: 'auto', marginTop: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#f8fafc', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderBottom: '2px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>SR. NO.</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left' }}>RGP NO.</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left' }}>MATERIAL DETAIL</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>QTY</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left' }}>SUPPLIER</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>GATE ENTRY</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>MATERIAL RECEIVED</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>RGP ISSUE</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>RGP RETURN</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>AGING</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rgpRows.map((row, idx) => {
                      const agingDays = Math.max(0, Math.floor((new Date() - new Date(row.firstScanDate)) / (1000 * 60 * 60 * 24)));
                      const isRgp = String(row.rgpNo).toUpperCase().includes('RGP');
                      
                      let associatedLots = [];
                      if (isRgp && row.rgpEntry && row.rgpEntry.rgp_payload) {
                        try {
                          const payload = JSON.parse(row.rgpEntry.rgp_payload);
                          if (payload && Array.isArray(payload.entries)) {
                            associatedLots = payload.entries.map(e => String(e.lotNo).toLowerCase().trim());
                          }
                        } catch(e){}
                      }

                      const cleanRgpNo = String(row.rgpNo).toLowerCase().trim();
                      const hasZipPo = zipHeaders.some(h => String(h.Lot_Number).toLowerCase().trim() === cleanRgpNo) || associatedLots.some(lot => zipHeaders.some(h => String(h.Lot_Number).toLowerCase().trim() === lot));
                      const hasDoriPo = doriOrders.some(h => String(h.Lot_Number).toLowerCase().trim() === cleanRgpNo) || associatedLots.some(lot => doriOrders.some(h => String(h.Lot_Number).toLowerCase().trim() === lot));
                      const hasTrimPo = trimPOs.some(po => 
                        (po.designName && String(po.designName).toLowerCase().trim() === cleanRgpNo) ||
                        (po.poNumber && String(po.poNumber).toLowerCase().trim() === cleanRgpNo)
                      ) || associatedLots.some(lot => trimPOs.some(po => 
                        (po.designName && String(po.designName).toLowerCase().trim() === lot) ||
                        (po.poNumber && String(po.poNumber).toLowerCase().trim() === lot)
                      ));

                      return (
                        <tr key={row.rgpNo} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          <td style={{ padding: '16px 8px', textAlign: 'center', fontWeight: '600', color: '#94a3b8' }}>{idx + 1}</td>
                          <td style={{ padding: '16px 8px' }}>
                            <div style={{ fontWeight: '700', color: '#38bdf8', fontSize: '13px' }}>{row.rgpNo}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                              {isRgp && (
                                <span style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700' }}>
                                  Returnable Gate Pass
                                </span>
                              )}
                              {hasZipPo && (
                                <span style={{ backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700' }}>
                                  Zip Purcharge Orders
                                </span>
                              )}
                              {hasDoriPo && (
                                <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700' }}>
                                  Dori Purcharge Orders
                                </span>
                              )}
                              {hasTrimPo && (
                                <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700' }}>
                                  TRIM PO
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '16px 8px', fontWeight: '600' }}>{row.materialName}</td>
                          <td style={{ padding: '16px 8px', textAlign: 'center', fontWeight: '700' }}>{row.quantity}</td>
                          <td style={{ padding: '16px 8px' }}>{row.supplierName || '—'}</td>

                          {/* Gate Entry Status */}
                          <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                            {row.gateEntry ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700', display: 'inline-block' }}>
                                  ✓ Done
                                </span>
                                <span style={{ fontWeight: '600', fontSize: '10.5px', color: '#e2e8f0', marginTop: '4px' }}>{row.gateEntry.person_name}</span>
                                <span style={{ fontSize: '9px', color: '#94a3b8' }}>{new Date(row.gateEntry.scanned_at).toLocaleDateString()}</span>
                              </div>
                            ) : (
                              <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700' }}>
                                ● Pending
                              </span>
                            )}
                          </td>

                          {/* Material Received Status */}
                          <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                            {row.materialIn ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700', display: 'inline-block' }}>
                                  ✓ Received
                                </span>
                                <span style={{ fontWeight: '600', fontSize: '10.5px', color: '#e2e8f0', marginTop: '4px' }}>{row.materialIn.person_name}</span>
                                <span style={{ fontSize: '9px', color: '#94a3b8' }}>{new Date(row.materialIn.scanned_at).toLocaleDateString()}</span>
                              </div>
                            ) : (
                              <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700' }}>
                                ● Pending
                              </span>
                            )}
                          </td>

                          {/* RGP Issue Status */}
                          <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                            {row.rgpEntry ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700', display: 'inline-block' }}>
                                  ✓ Done
                                </span>
                                <span style={{ fontWeight: '600', fontSize: '10.5px', color: '#e2e8f0', marginTop: '4px' }}>{row.rgpEntry.person_name}</span>
                                <span style={{ fontSize: '9px', color: '#94a3b8' }}>{new Date(row.rgpEntry.scanned_at).toLocaleDateString()}</span>
                              </div>
                            ) : (
                              <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700' }}>
                                ● Pending
                              </span>
                            )}
                          </td>

                          {/* RGP Return Status */}
                          <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                            {row.rgpReturn ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{ backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700', display: 'inline-block' }}>
                                  ✓ Returned
                                </span>
                                <span style={{ fontWeight: '600', fontSize: '10.5px', color: '#e2e8f0', marginTop: '4px' }}>{row.rgpReturn.person_name}</span>
                                <span style={{ fontSize: '9px', color: '#94a3b8' }}>{new Date(row.rgpReturn.scanned_at).toLocaleDateString()}</span>
                              </div>
                            ) : (
                              <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700' }}>
                                ● Pending
                              </span>
                            )}
                          </td>

                          {/* Aging Days */}
                          <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block' }}>
                              {agingDays} days
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* Professional Header */}
      <div style={styles.headerWrapper}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <button type="button" onClick={handleBack} style={styles.backButton}>
              <Emoji size={18} mr={8}>←</Emoji>
              Back
            </button>
            <div style={styles.logoContainer}>
              <div style={styles.logoIcon}>🏭</div>
              <div style={styles.logoText}>Textile ERP</div>
            </div>
          </div>
          <div style={styles.headerCenter}>
            <h1 style={styles.headerTitle}>
              <Emoji size={28} mr={12}>📋</Emoji>
              Returnable Gate Pass
            </h1>
            <p style={styles.headerSubtitle}>
              <Emoji size={14} mr={6}>🏭</Emoji>
              Material Issue & Return Tracking System
            </p>
          </div>
          <div style={styles.rgpBadge}>
            <div style={styles.badgeLabel}>RGP Number</div>
            <div style={styles.badgeValue}>{form.rgpNo}</div>
          </div>
        </div>
      </div>

      {/* Mode Selector Control */}
      <div style={{ ...styles.modeSelectorContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: '14px', padding: '6px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => { setRgpMode("automatic"); setWizardStep(1); }}
            style={{
              ...styles.modeTab,
              ...(rgpMode === "automatic" ? styles.modeTabActive : {}),
              border: 'none',
              margin: 0
            }}
          >
            <Emoji size={16} mr={8}>⚡</Emoji>
            Automatic RGP (Lot & Cutting Matrix)
          </button>
          <button
            type="button"
            onClick={() => { setRgpMode("manual"); }}
            style={{
              ...styles.modeTab,
              ...(rgpMode === "manual" ? styles.modeTabActive : {}),
              border: 'none',
              margin: 0
            }}
          >
            <Emoji size={16} mr={8}>✍️</Emoji>
            Manual RGP (Direct Entry)
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowTrackerModal(true)}
          style={{
            ...styles.modeTab,
            backgroundColor: '#0f2b3d',
            color: '#ffffff',
            fontWeight: '700',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            marginRight: '6px'
          }}
        >
          <Emoji size={16} mr={0}>🔍</Emoji>
          Track RGP Status
        </button>
      </div>

      <form onSubmit={handlePreview} style={styles.form}>
        {rgpMode === "manual" ? (
          /* MANUAL RGP MODE: Direct Entry Layout */
          <div style={styles.formBody}>
            {/* Left Column - Details */}
            <div style={styles.leftColumn}>
              {renderLeftColumnDetails()}
            </div>

            {/* Right Column - Items */}
            <div style={styles.rightColumn}>
              {renderCustomItemCard()}
              {renderGatePassItemsListCard()}
            </div>
          </div>
        ) : (
          /* AUTOMATIC RGP MODE: Multi-step Wizard */
          <div>
            {renderWizardStepsIndicator()}

            {/* Step 1: Center-aligned lot search */}
            {wizardStep === 1 && (
              <div style={styles.wizardCenteredStepContainer}>
                {renderLotSearchStepCard()}
              </div>
            )}

            {/* Step 2: Configure Matrix & Accessories */}
            {wizardStep === 2 && (
              <div style={styles.formBody}>
                <div style={styles.leftColumn}>
                  {renderLotSummaryAndBomPillsCard()}
                </div>
                <div style={styles.rightColumn}>
                  {selectedBomItem ? renderAccessoryConfigAndMatrixCard() : (
                    <div style={{ ...styles.section, textAlign: 'center', padding: '64px 32px', color: '#64748b' }}>
                      <Emoji size={48} mr={0}>👉</Emoji>
                      <h3 style={{ marginTop: '16px', color: '#0f2b3d' }}>Select BOM Pill</h3>
                      <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '280px', margin: '8px auto 0' }}>
                        Please select an accessory pill on the left panel to load the matrix configure details.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Issue details & review */}
            {wizardStep === 3 && (
              <div style={styles.formBody}>
                <div style={styles.leftColumn}>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
                    <button
                      type="button"
                      onClick={() => { setWizardStep(2); }}
                      style={styles.wizardBackButton}
                    >
                      ← Back to Matrix
                    </button>
                  </div>
                  {renderLeftColumnDetails()}
                </div>
                <div style={styles.rightColumn}>
                  {renderGatePassItemsListCard()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Bar: only active for manual mode or wizard step 3 */}
        {(rgpMode === "manual" || wizardStep === 3) && (
          <div style={styles.actionBar}>
            <button type="button" onClick={handleReset} disabled={submitting || submissionComplete} style={styles.secondaryButton}>
              <Emoji size={16} mr={6}>↺</Emoji>
              Reset Form
            </button>
            <div style={styles.actionButtons}>
              <button type="submit" disabled={submitting || submissionComplete} style={styles.previewButton}>
                <Emoji size={16} mr={6}>👁️</Emoji>
                Preview Document
              </button>
              <button type="button" onClick={handleFinalSubmit} disabled={submitting || submissionComplete} style={styles.primaryButton}>
                <Emoji size={16} mr={6}>{submitting ? "⏳" : "✓"}</Emoji>
                {submitting ? "Processing..." : "Save & Create Rgp"}
              </button>
            </div>
          </div>
        )}
      </form>

      {showPreview && (
        <PreviewModal
          payload={{
            ...form,
            rgpType: rgpMode === "automatic" && selectedBomItem ? selectedBomItem.name : form.rgpType
          }}
          onClose={() => setShowPreview(false)}
          onConfirm={handleFinalSubmit}
          loading={submitting}
        />
      )}

      {showTrackerModal && renderTrackerModal()}
    </div>
  );
}

// Professional Modern Styles - Navy & White Theme with Enhanced Typography
const styles = {
  container: {
    maxWidth: "2200px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    backgroundColor: "#ffffff",
    minHeight: "100vh",
  },
  headerWrapper: {
    marginBottom: "28px",
  },
  header: {
    background: "linear-gradient(135deg, #0f2b3d 0%, #1a4a6f 100%)",
    borderRadius: "20px",
    padding: "24px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "20px",
    boxShadow: "0 10px 30px rgba(0, 15, 151, 0.15)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },
  backButton: {
    display: "inline-flex",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    color: "white",
    border: "1px solid rgba(255, 255, 255, 0.25)",
    padding: "10px 20px",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "600",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.25)",
    },
  },
  logoContainer: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: "8px 16px",
    borderRadius: "40px",
  },
  logoIcon: {
    fontSize: "28px",
  },
  logoText: {
    fontSize: "1rem",
    fontWeight: "600",
    color: "white",
    letterSpacing: "0.5px",
  },
  headerCenter: {
    textAlign: "center",
  },
  headerTitle: {
    margin: 0,
    fontSize: "2.5rem",
    fontWeight: "700",
    color: "white",
    display: "flex",
    alignItems: "center",
    letterSpacing: "-0.3px",
  },
  headerSubtitle: {
    margin: "8px 0 0 0",
    fontSize: "0.95rem",
    color: "rgba(255, 247, 247, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  rgpBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    padding: "12px 20px",
    borderRadius: "16px",
    textAlign: "center",
    minWidth: "140px",
  },
  badgeLabel: {
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "1px",
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: "4px",
  },
  badgeValue: {
    fontSize: "1.1rem",
    fontWeight: "700",
    color: "white",
    fontFamily: "monospace",
  },
  form: {
    backgroundColor: "white",
    borderRadius: "20px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
    overflow: "hidden",
  },
  formBody: {
    display: "grid",
    gridTemplateColumns: "480px 1fr",
    gap: "0",
    "@media (max-width: 1200px)": {
      gridTemplateColumns: "1fr",
    },
  },
  leftColumn: {
    padding: "28px",
    borderRight: "1px solid #e2e8f0",
    backgroundColor: "#ffffff",
  },
  rightColumn: {
    padding: "28px",
    backgroundColor: "#ffffff",
  },
  section: {
    marginBottom: "32px",
    "&:last-child": {
      marginBottom: 0,
    },
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    marginBottom: "20px",
    paddingBottom: "12px",
    borderBottom: "2px solid #e2e8f0",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "1.15rem",
    fontWeight: "600",
    color: "#0f2b3d",
    flex: 1,
  },
  requiredBadge: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    fontSize: "0.7rem",
    padding: "4px 10px",
    borderRadius: "20px",
    fontWeight: "500",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "14px 16px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    marginBottom: "8px",
    fontWeight: "600",
    color: "#000000",
    fontSize: "0.85rem",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  requiredStar: {
    color: "#dc2626",
    marginLeft: "4px",
  },
  input: {
    padding: "12px 14px",
    border: "1.5px solid #e2e8f0",
    borderRadius: "10px",
    fontSize: "0.9rem",
    transition: "all 0.2s ease",
    backgroundColor: "white",
    fontFamily: "inherit",
    outline: "none",
    color: "#000000",
    "&:focus": {
      borderColor: "#1a4a6f",
      boxShadow: "0 0 0 3px rgba(26, 74, 111, 0.1)",
    },
  },
  inputReadonly: {
    padding: "12px 14px",
    border: "1.5px solid #e2e8f0",
    borderRadius: "10px",
    fontSize: "0.9rem",
    backgroundColor: "#f1f5f9",
    fontFamily: "monospace",
    fontWeight: "600",
    color: "#000000",
  },
  inputError: {
    borderColor: "#dc2626",
    backgroundColor: "#fef2f2",
  },
  errorText: {
    color: "#dc2626",
    fontSize: "0.7rem",
    marginTop: "6px",
  },
  textarea: {
    padding: "12px 14px",
    border: "1.5px solid #e2e8f0",
    borderRadius: "10px",
    fontSize: "0.9rem",
    resize: "vertical",
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    "&:focus": {
      borderColor: "#1a4a6f",
      boxShadow: "0 0 0 3px rgba(26, 74, 111, 0.1)",
    },
  },
  addButton: {
    display: "inline-flex",
    alignItems: "center",
    backgroundColor: "#1a4a6f",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "10px",
    fontSize: "0.8rem",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
    "&:hover": {
      backgroundColor: "#0f2b3d",
    },
  },
  itemsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxHeight: "520px",
    overflowY: "auto",
    paddingRight: "8px",
    paddingBottom: "8px",
  },
  itemCard: {
    backgroundColor: "white",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
    transition: "box-shadow 0.2s ease",
    flexShrink: 0,
    "&:hover": {
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
    },
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
    paddingBottom: "12px",
    borderBottom: "1px dashed #cbd5e1",
  },
  itemNumber: {
    fontSize: "0.9rem",
    fontWeight: "700",
    color: "#1a4a6f",
    backgroundColor: "#eef2ff",
    padding: "4px 12px",
    borderRadius: "20px",
  },
  removeButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "transparent",
    color: "#dc2626",
    border: "1px solid #fecaca",
    padding: "6px 12px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.75rem",
    fontWeight: "500",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
    "&:hover": {
      backgroundColor: "#fef2f2",
    },
  },
  itemGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "14px",
  },
  formGroupCompact: {
    display: "flex",
    flexDirection: "column",
  },
  labelCompact: {
    marginBottom: "6px",
    fontWeight: "500",
    color: "#000000",
    fontSize: "0.9rem",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  inputCompact: {
    padding: "10px 12px",
    border: "1.5px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "0.85rem",
    transition: "all 0.2s ease",
    backgroundColor: "white",
    fontFamily: "inherit",
    outline: "none",
    "&:focus": {
      borderColor: "#1a4a6f",
      boxShadow: "0 0 0 2px rgba(26, 74, 111, 0.1)",
    },
  },
  inputCompactError: {
    borderColor: "#dc2626",
    backgroundColor: "#fef2f2",
  },
  errorCompact: {
    color: "#dc2626",
    fontSize: "0.65rem",
    marginTop: "4px",
  },
  summaryBar: {
    marginTop: "20px",
    padding: "20px 24px",
    backgroundColor: "#0f2b3d",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 6px 20px rgba(15, 43, 61, 0.12)",
  },
  summaryItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  summaryLabel: {
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  summaryValue: {
    fontSize: "1.4rem",
    fontWeight: "800",
    color: "#ffffff",
  },
  summaryDivider: {
    color: "#334155",
    fontSize: "1.5rem",
    fontWeight: "300",
  },
  actionBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 28px",
    backgroundColor: "#f8fafc",
    borderTop: "1px solid #e2e8f0",
  },
  actionButtons: {
    display: "flex",
    gap: "16px",
  },
  previewButton: {
    padding: "12px 24px",
    backgroundColor: "#1a4a6f",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "inline-flex",
    alignItems: "center",
    fontFamily: "inherit",
    "&:hover": {
      backgroundColor: "#0f2b3d",
      transform: "translateY(-1px)",
    },
  },
  primaryButton: {
    padding: "12px 28px",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "0.9rem",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "inline-flex",
    alignItems: "center",
    fontFamily: "inherit",
    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
    "&:hover": {
      transform: "translateY(-1px)",
      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
    },
  },
  secondaryButton: {
    padding: "12px 24px",
    backgroundColor: "white",
    color: "#475569",
    border: "1.5px solid #cbd5e1",
    borderRadius: "12px",
    fontSize: "0.9rem",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "inline-flex",
    alignItems: "center",
    fontFamily: "inherit",
    "&:hover": {
      backgroundColor: "#f8fafc",
      borderColor: "#94a3b8",
    },
  },
  searchButton: {
    padding: "12px 24px",
    backgroundColor: "#1a4a6f",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  errorAlert: {
    padding: "12px 16px",
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "12px",
    color: "#dc2626",
    fontSize: "0.9rem",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
  },
  designSummaryCard: {
    padding: "16px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
  },
  designSummaryHeader: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "10px",
    fontSize: "0.95rem",
    color: "#0f2b3d",
  },
  bomPill: {
    padding: "8px 16px",
    backgroundColor: "white",
    color: "#1a4a6f",
    border: "1.5px solid #cbd5e1",
    borderRadius: "40px",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  bomPillActive: {
    backgroundColor: "#1a4a6f",
    color: "white",
    borderColor: "#1a4a6f",
  },
  matrixFormGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  matrixTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.85rem",
  },
  matrixTableHeaderRow: {
    backgroundColor: "#f1f5f9",
    borderBottom: "2px solid #e2e8f0",
  },
  matrixTableRow: {
    borderBottom: "1px solid #e2e8f0",
  },
  addButtonInline: {
    padding: "10px 20px",
    backgroundColor: "#10b981",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "0.85rem",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  itemCardReview: {
    padding: "12px 16px",
    backgroundColor: "#ffffff",
    border: "1.5px solid #e2e8f0",
    borderRadius: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
    position: "relative",
    overflow: "hidden",
    flexShrink: 0,
    minHeight: "64px",
    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.02)",
    transition: "all 0.2s ease",
    boxSizing: "border-box",
  },
  itemCardReviewAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "4px",
    backgroundColor: "#1a4a6f",
    borderRadius: "12px 0 0 12px",
  },
  itemCardReviewLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flex: 1,
    minWidth: 0,
    paddingRight: "12px",
  },
  itemCardReviewTitle: {
    fontSize: "0.95rem",
    fontWeight: "600",
    color: "#0f2b3d",
    lineHeight: "1.3",
    wordBreak: "break-word",
  },
  itemCardReviewMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    alignItems: "center",
  },
  metaBadgeLot: {
    fontSize: "0.75rem",
    padding: "3px 8px",
    backgroundColor: "#e0f2fe",
    color: "#0369a1",
    borderRadius: "6px",
    fontWeight: "500",
    lineHeight: "1.2",
    display: "inline-flex",
    alignItems: "center",
  },
  metaBadgeDept: {
    fontSize: "0.75rem",
    padding: "3px 8px",
    backgroundColor: "#f3e8ff",
    color: "#6b21a8",
    borderRadius: "6px",
    fontWeight: "500",
    lineHeight: "1.2",
    display: "inline-flex",
    alignItems: "center",
  },
  metaBadgePurpose: {
    fontSize: "0.75rem",
    padding: "3px 8px",
    backgroundColor: "#fef3c7",
    color: "#92400e",
    borderRadius: "6px",
    fontWeight: "500",
    lineHeight: "1.2",
    display: "inline-flex",
    alignItems: "center",
  },
  itemCardReviewRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexShrink: 0,
  },
  itemCardReviewQtyBadge: {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 12px",
    backgroundColor: "#ecfdf5",
    border: "1px solid #a7f3d0",
    borderRadius: "8px",
    minWidth: "65px",
    flexShrink: 0,
  },
  itemCardReviewQtyValue: {
    fontSize: "1rem",
    fontWeight: "700",
    color: "#065f46",
    lineHeight: "1.1",
  },
  itemCardReviewQtyUom: {
    fontSize: "0.65rem",
    fontWeight: "600",
    color: "#047857",
    textTransform: "uppercase",
    marginTop: "2px",
  },
  itemCardReviewBags: {
    fontSize: "0.75rem",
    color: "#64748b",
    backgroundColor: "#f1f5f9",
    padding: "4px 8px",
    borderRadius: "6px",
    fontWeight: "500",
    whiteSpace: "nowrap",
  },
  removeButtonReview: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    cursor: "pointer",
    color: "#dc2626",
    padding: "8px",
    borderRadius: "8px",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  modeSelectorContainer: {
    display: "flex",
    gap: "12px",
    marginBottom: "28px",
    backgroundColor: "#f1f5f9",
    padding: "6px",
    borderRadius: "14px",
    width: "fit-content",
    border: "1.5px solid #e2e8f0",
  },
  modeTab: {
    padding: "12px 24px",
    backgroundColor: "transparent",
    color: "#475569",
    border: "none",
    borderRadius: "10px",
    fontSize: "0.95rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
  },
  modeTabActive: {
    backgroundColor: "white",
    color: "#1a4a6f",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.05)",
  },
  wizardIndicatorContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: "20px 32px",
    borderRadius: "16px",
    border: "1.5px solid #e2e8f0",
    marginBottom: "28px",
    gap: "12px",
  },
  wizardStepNode: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    padding: "8px 16px",
    borderRadius: "12px",
    transition: "all 0.2s ease",
  },
  wizardStepNodeActive: {
    backgroundColor: "rgba(26, 74, 111, 0.08)",
    color: "#1a4a6f",
    fontWeight: "700",
  },
  wizardStepNodeCompleted: {
    color: "#10b981",
  },
  wizardStepNodeNum: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    backgroundColor: "#cbd5e1",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.85rem",
    fontWeight: "700",
  },
  wizardStepNodeNumActive: {
    backgroundColor: "#1a4a6f",
  },
  wizardStepNodeNumCompleted: {
    backgroundColor: "#10b981",
  },
  wizardStepNodeLabel: {
    fontSize: "0.95rem",
  },
  wizardStepLine: {
    flex: 1,
    height: "2.5px",
    backgroundColor: "#e2e8f0",
  },
  wizardStepLineCompleted: {
    backgroundColor: "#10b981",
  },
  wizardCenteredStepContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "60px 20px",
    width: "100%",
  },
  wizardSearchCard: {
    width: "100%",
    maxWidth: "580px",
    backgroundColor: "#ffffff",
    border: "1.5px solid #e2e8f0",
    borderRadius: "24px",
    padding: "40px",
    boxShadow: "0 15px 40px rgba(0, 0, 0, 0.04)",
  },
  wizardBackButton: {
    padding: "8px 16px",
    backgroundColor: "#f1f5f9",
    color: "#475569",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  wizardForwardButton: {
    padding: "8px 16px",
    backgroundColor: "#1a4a6f",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
};

// Add hover styles as CSS (since inline styles don't support :hover)
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  button:hover {
    transform: translateY(-1px);
  }
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: #1a4a6f !important;
    box-shadow: 0 0 0 3px rgba(26, 74, 111, 0.15) !important;
  }
  .matrixTable th {
    padding: 10px 8px;
    font-weight: 700;
    color: #475569;
    border-bottom: 2.5px solid #cbd5e1;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .matrixTable td {
    padding: 10px 8px;
    border-bottom: 1.5px solid #e2e8f0;
    color: #0f2b3d;
  }
  .bom-pill {
    transition: all 0.2s ease-in-out;
  }
  .bom-pill:hover {
    border-color: #1a4a6f !important;
    background-color: #f1f5f9 !important;
    transform: scale(1.02);
  }
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 10px;
  }
  ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;
document.head.appendChild(styleSheet);