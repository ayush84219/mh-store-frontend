import { getBackendUrl } from '../utils/api';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiSearch, FiRefreshCw, FiAlertTriangle, FiUser, FiCalendar, FiX, FiCheck,
    FiScissors, FiInfo, FiPackage, FiTag, FiGrid, FiArrowLeft, FiDownload, FiPrinter,
    FiPlus, FiTrash2, FiCheckSquare, FiSquare, FiTruck, FiLogIn, FiLock
} from 'react-icons/fi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

// ---------- Caching Helpers ----------
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
    const item = cache.get(key);
    if (item && Date.now() - item.timestamp < CACHE_DURATION) {
        return item.data;
    }
    cache.delete(key);
    return null;
}

function setCached(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

// ---------- Optimized Helpers ----------
function uniqCaseInsensitive(arr) {
    const seen = new Set();
    const out = [];
    for (const s of arr ?? []) {
        const k = String(s ?? "").trim().toLowerCase();
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(s);
    }
    return out;
}

function titleCase(str) {
    return String(str ?? "")
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================
// Config
// ============================
const GOOGLE_API_KEY = "";
const SHEET_ID = "";
const SHEET_IDD = "";
const SHEET_IDDD = "";

// Simple QR System URL - DYNAMICALLY SET TO FRONTEND URL
const QR_SYSTEM_URL = window.location.origin + "/";

// QR Code Helper Function
const toDataURL = (src) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0);
            resolve(c.toDataURL("image/png"));
        };
        img.onerror = () => reject(new Error("QR image load failed"));
        img.src = src;
    });

// Helpers
const norm = (v) => (v ?? '').toString().trim();
const eq = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase();
const includes = (hay, needle) => norm(hay).toLowerCase().includes(norm(needle).toLowerCase());

function todayLocalISO() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
}

// ============================
// LOT helpers
// ============================
function digitsOnly(s) {
    const m = String(s ?? '').match(/\d+/g);
    return m ? m.join('') : '';
}

function classifyLot(lotInput) {
    const d = digitsOnly(lotInput);
    const searchKey = d;
    return { searchKey };
}

// ============================
// Optimized Data Fetching
// ============================
async function fetchWithCache(url, cacheKey, signal) {
    const cached = getCached(cacheKey);
    if (cached) {
        console.log('Using cached:', cacheKey);
        return cached;
    }

    const res = await fetch(url, { signal });
    if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
    }

    const data = await res.json();
    setCached(cacheKey, data);
    return data;
}

// Fetch all required data in parallel
async function fetchAllRequiredData(signal) {
    const cacheKey = 'all_config_data';
    const cached = getCached(cacheKey);
    if (cached) {
        console.log('Using cached config data');
        return cached;
    }

    try {
        const [garmentConfig, zipData] = await Promise.all([
            fetchGarmentZipConfig(signal),
            fetchZipQualityData(signal)
        ]);

        const result = { garmentConfig, zipData };
        setCached(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Failed to fetch required data:', error);
        throw error;
    }
}
function parseCSVText(text) {
    const lines = text.split(/\r?\n/);
    return lines.map(line => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }).filter(row => row.length > 0 && row.some(cell => cell !== ''));
}

async function fetchGarmentZipConfig(signal) {
    const defaultConfig = {
        "t-shirt r/n": ["DEFAULT"],
        "t-shirt collar": ["DEFAULT"],
        "lower": ["DEFAULT"],
        "sweatshirt r/n": ["DEFAULT"],
        "sweatshirt hoodie": ["DEFAULT"],
        "sweatshirt collar": ["DEFAULT"],
        "windcheater": ["DEFAULT"],
        "jacket": ["DEFAULT"],
        "track suit": ["DEFAULT"],
        "shirt": ["DEFAULT"],
        "jogger": ["DEFAULT"],
        "sandow": ["DEFAULT"],
        "nikker": ["DEFAULT"],
        "dropshoulder": ["DEFAULT"],
        "track suit + shirt": ["DEFAULT"],
        "track suit + t-shirt": ["DEFAULT"],
        "tracksuit + lower": ["DEFAULT"],
        "ts - upper": ["DEFAULT"],
        "ts - lower": ["DEFAULT"]
    };

    try {
        const url = 'https://docs.google.com/spreadsheets/d/1sakbedDFEKimbF73mBsFU7OuCei4UqQt9PvXcpq6SB0/export?format=csv&gid=1273734245';
        const res = await fetch(url, { signal });
        if (!res.ok) {
            throw new Error(`Failed to fetch garment zip config: ${res.status}`);
        }
        const text = await res.text();
        const rows = parseCSVText(text);
        if (rows.length < 2) return defaultConfig;

        const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
        const typeIndex = headers.findIndex(h => h.includes('garment') || h.includes('type'));
        const optionsIndex = headers.findIndex(h => h.includes('option') || h.includes('zip'));

        if (typeIndex === -1 || optionsIndex === -1) return defaultConfig;

        const config = {};
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const garmentType = String(row[typeIndex] || '').trim().toLowerCase();
            const optionsStr = String(row[optionsIndex] || '').trim();
            if (garmentType && optionsStr) {
                const options = optionsStr.split(',').map(o => o.trim()).filter(Boolean);
                if (options.length > 0) {
                    config[garmentType] = options;
                }
            }
        }
        return Object.keys(config).length > 0 ? config : defaultConfig;
    } catch (err) {
        console.warn('Failed to fetch garment zip config from sheet, using default:', err.message);
        return defaultConfig;
    }
}

async function fetchZipQualityData(signal) {
    const url = 'https://docs.google.com/spreadsheets/d/1sakbedDFEKimbF73mBsFU7OuCei4UqQt9PvXcpq6SB0/export?format=csv';
    const res = await fetch(url, { signal });
    if (!res.ok) {
        throw new Error(`Failed to fetch zip quality data sheet: ${res.status}`);
    }
    const text = await res.text();
    const rows = parseCSVText(text);

    const zipData = [];
    if (rows.length > 1) {
        const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
        const zipIndex = headers.findIndex(h => h.includes('zip') || h.includes('type'));
        const colorIndex = headers.findIndex(h => h.includes('color') || h.includes('colour'));
        const priceIndex = headers.findIndex(h => h.includes('price') || h.includes('approx') || h.includes('rate') || h.includes('cost'));

        if (zipIndex !== -1 && colorIndex !== -1 && priceIndex !== -1) {
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const zipType = row[zipIndex];
                const color = row[colorIndex];
                const price = row[priceIndex];
                if (zipType && color && price) {
                    const priceNum = parseFloat(String(price || '').replace(/[₹,]/g, '').trim()) || 0;
                    zipData.push({
                        type: String(zipType || '').replace(/"/g, '').trim(),
                        color: String(color || '').replace(/"/g, '').trim(),
                        price: priceNum
                    });
                }
            }
        }
    }
    return zipData;
}

// ============================
// Optimized Lot Matrix Fetching
// ============================
async function fetchLotMatrixViaSheetsApi(lotNo, signal) {
    const { searchKey } = classifyLot(lotNo);
    console.log('Searching for lot locally:', { searchKey });

    const API_BASE_URL = `${getBackendUrl()}/api`;
    try {
        const res = await fetch(`${API_BASE_URL}/cutting/${searchKey}`, { signal });
        if (res.ok) {
            const data = await res.json();
            const sizeKeys = ['M', 'L', 'XL', 'XXL'];

            const totals = { perSize: {}, grand: 0 };
            for (const k of sizeKeys) totals.perSize[k] = 0;
            for (const row of data.rows) {
                totals.grand += row.totalPcs || 0;
                for (const k of sizeKeys) {
                    totals.perSize[k] += row.sizes[k] ?? 0;
                }
            }

            return {
                lotNumber: data.lotNumber,
                style: data.style,
                fabric: data.fabric,
                garmentType: data.garmentType,
                brand: data.brand,
                partyName: data.partyName,
                sizes: sizeKeys,
                rows: data.rows,
                totals,
                source: 'cutting'
            };
        }
    } catch (dbErr) {
        console.warn('Failed to fetch from local database, trying Google Sheet fallback:', dbErr.message);
    }

    // Fallback: Fetch from ZipPurchaseOrders sheet (gid=1773429271) in spreadsheet 1sakbedDFEKimbF73mBsFU7OuCei4UqQt9PvXcpq6SB0
    try {
        console.log('Searching in ZipPurchaseOrders Google Sheet fallback for lot:', searchKey);
        const sheetUrl = 'https://docs.google.com/spreadsheets/d/1sakbedDFEKimbF73mBsFU7OuCei4UqQt9PvXcpq6SB0/export?format=csv&gid=1773429271';
        const resSheet = await fetch(sheetUrl, { signal });
        if (!resSheet.ok) {
            throw new Error(`Failed to access Google Sheet fallback: ${resSheet.status}`);
        }

        const text = await resSheet.text();
        const rows = parseCSVText(text);
        if (rows.length < 2) {
            throw new Error('Google Sheet is empty or header-only');
        }

        const headers = rows[0].map(norm);
        const lotIndex = headers.findIndex(h => includes(h, 'lot number') || includes(h, 'lot'));
        const typeIndex = headers.findIndex(h => includes(h, 'garment') || includes(h, 'type'));
        const styleIndex = headers.findIndex(h => includes(h, 'style'));
        const fabricIndex = headers.findIndex(h => includes(h, 'fabric'));
        const piecesIndex = headers.findIndex(h => includes(h, 'pieces') || includes(h, 'total'));
        const colorIndex = headers.findIndex(h => includes(h, 'color') || includes(h, 'breakdown'));

        if (lotIndex === -1) {
            throw new Error('Lot Number column not found in Google Sheet');
        }

        // Search for the row matching our lot number
        const matchedRow = rows.find(r => norm(r[lotIndex]) === norm(searchKey));
        if (!matchedRow) {
            throw new Error(`Lot ${searchKey} not found in database or Google Sheet.`);
        }

        const lotNumber = norm(matchedRow[lotIndex]);
        const garmentType = typeIndex !== -1 ? norm(matchedRow[typeIndex]) : '';
        const style = styleIndex !== -1 ? norm(matchedRow[styleIndex]) : '';
        const fabric = fabricIndex !== -1 ? norm(matchedRow[fabricIndex]) : '';
        const totalPieces = piecesIndex !== -1 ? parseInt(norm(matchedRow[piecesIndex]), 10) || 0 : 0;
        const breakdownStr = colorIndex !== -1 ? norm(matchedRow[colorIndex]) : '';

        // Parse Color Breakdown: e.g. "BLACK: 60pcs (Selected - Black); CAMEL: 60pcs (Selected - Coloured)"
        const matrixRows = [];
        if (breakdownStr) {
            const parts = breakdownStr.split(';');
            parts.forEach(part => {
                const match = part.match(/^\s*([^:]+):\s*(\d+)pcs/);
                if (match) {
                    const color = match[1].trim();
                    const pcs = parseInt(match[2], 10) || 0;
                    matrixRows.push({
                        color,
                        cuttingTable: null,
                        sizes: { M: Math.round(pcs / 4), L: Math.round(pcs / 4), XL: Math.round(pcs / 4), XXL: Math.round(pcs / 4) },
                        totalPcs: pcs
                    });
                }
            });
        }

        // If no colors could be parsed, add a default color row
        if (matrixRows.length === 0) {
            matrixRows.push({
                color: 'DEFAULT',
                cuttingTable: null,
                sizes: { M: Math.round(totalPieces / 4), L: Math.round(totalPieces / 4), XL: Math.round(totalPieces / 4), XXL: Math.round(totalPieces / 4) },
                totalPcs: totalPieces
            });
        }

        const sizeKeys = ['M', 'L', 'XL', 'XXL'];
        const totals = { perSize: {}, grand: 0 };
        for (const k of sizeKeys) totals.perSize[k] = 0;
        for (const row of matrixRows) {
            totals.grand += row.totalPcs || 0;
            for (const k of sizeKeys) {
                totals.perSize[k] += row.sizes[k] ?? 0;
            }
        }

        return {
            lotNumber,
            style,
            fabric,
            garmentType,
            brand: '',
            partyName: '',
            sizes: sizeKeys,
            rows: matrixRows,
            totals,
            source: 'sheet_po'
        };

    } catch (sheetErr) {
        console.error('Google Sheet fallback error:', sheetErr.message);
        throw new Error(sheetErr.message);
    }
}

// ============================
// Sheets access — Index & Cutting
// ============================
async function fetchIndexSheet(signal) {
    try {
        const range = encodeURIComponent('Index!A1:Z');
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;
        const res = await fetch(url, { signal });

        if (!res.ok) {
            throw new Error(`Failed to access Index sheet: ${res.status}`);
        }

        const data = await res.json();
        if (!data?.values?.length) {
            throw new Error('Index sheet is empty');
        }

        console.log('Fetched Index sheet with', data.values.length, 'rows');
        return data.values;
    } catch (err) {
        console.error('Error fetching Index sheet:', err.message);
        throw err;
    }
}
function findLotInIndex(indexData, lotNo) {
    if (!indexData || indexData.length < 2) return null;

    const headers = indexData[0].map(norm);
    const lotNumberCol = headers.findIndex(h => includes(h, 'lot number'));
    const startRowCol = headers.findIndex(h => includes(h, 'startrow'));
    const numRowsCol = headers.findIndex(h => includes(h, 'numrows'));
    const headerColsCol = headers.findIndex(h => includes(h, 'headercols'));

    // Find the brand column index
    const brandCol = headers.findIndex(h => includes(h, 'brand'));
    // Find the party name column index
    const partyNameCol = headers.findIndex(h => includes(h, 'party name'));

    if (lotNumberCol === -1) {
        console.log('Lot Number column not found in Index sheet');
        return null;
    }

    for (let i = 1; i < indexData.length; i++) {
        const row = indexData[i] || [];
        const rowLotNo = norm(row[lotNumberCol]);

        if (rowLotNo === norm(lotNo)) {
            return {
                lotNumber: rowLotNo,
                startRow: startRowCol !== -1 ? parseInt(row[startRowCol]) || 1 : 1,
                numRows: numRowsCol !== -1 ? parseInt(row[numRowsCol]) || 20 : 20,
                headerCols: headerColsCol !== -1 ? parseInt(row[headerColsCol]) || 7 : 7,
                fabric: headers.includes('fabric') && row[headers.indexOf('fabric')] || '',
                garmentType: headers.includes('garment type') && row[headers.indexOf('garment type')] || '',
                // Use the actual brand column index
                brand: brandCol !== -1 && row[brandCol] ? norm(row[brandCol]) : '',
                style: headers.includes('style') && row[headers.indexOf('style')] || '',
                sizes: headers.includes('sizes') && row[headers.indexOf('sizes')] || '',
                shades: headers.includes('shades') && row[headers.indexOf('shades')] || '',
                // Use the actual party name column index (removed season)
                partyName: partyNameCol !== -1 && row[partyNameCol] ? norm(row[partyNameCol]) : '',
            };
        }
    }

    return null;
}
async function fetchExistingPurchaseOrders(lotNumber, signal) {
    try {
        console.log('🔍 Checking existing purchase orders for lot:', lotNumber);
        const url = 'https://docs.google.com/spreadsheets/d/1sakbedDFEKimbF73mBsFU7OuCei4UqQt9PvXcpq6SB0/export?format=csv&gid=1773429271';
        const response = await fetch(url, { signal });
        if (!response.ok) {
            throw new Error(`Failed to fetch purchase orders: ${response.status}`);
        }

        const csvText = await response.text();
        const rows = parseCSVText(csvText);
        if (rows.length < 2) {
            console.log('No purchase orders found');
            return null;
        }

        const headers = rows[0].map(norm);
        console.log('Purchase order headers:', headers);

        // Find column indices
        const lotNumberIndex = headers.findIndex(h =>
            includes(h, 'lot number') || includes(h, 'lot')
        );
        const zipSelectionsIndex = headers.findIndex(h =>
            includes(h, 'zip selections') || includes(h, 'selections')
        );

        if (lotNumberIndex === -1 || zipSelectionsIndex === -1) {
            console.warn('Required columns not found in purchase orders');
            return null;
        }

        // Find existing orders for this lot
        const existingOrders = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i] || [];
            const rowLotNumber = norm(row[lotNumberIndex]);
            const zipSelections = row[zipSelectionsIndex];

            if (rowLotNumber === norm(lotNumber) && zipSelections) {
                try {
                    const selections = JSON.parse(zipSelections);
                    existingOrders.push(selections);
                    console.log(`Found existing order for lot ${lotNumber}:`, selections);
                } catch (parseError) {
                    console.warn('Failed to parse zip selections:', zipSelections);
                }
            }
        }

        return existingOrders.length > 0 ? existingOrders : null;
    } catch (error) {
        console.error('Error fetching purchase orders:', error);
        return null;
    }
}
async function fetchFromCuttingUsingIndex(lotInfo, signal) {
    const { startRow, numRows, headerCols, lotNumber } = lotInfo;

    try {
        const endRow = startRow + numRows - 1;
        const range = encodeURIComponent(`Cutting!A${startRow}:Z${endRow}`);

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;
        const res = await fetch(url, { signal });

        if (!res.ok) {
            throw new Error(`Failed to access Cutting sheet: ${res.status}`);
        }

        const data = await res.json();
        if (!data?.values?.length) {
            throw new Error('No data found in the specified range');
        }

        console.log(`Fetched ${data.values.length} rows from Cutting sheet using index`);
        console.log('Raw data:', data.values);

        const parsed = parseMatrixWithIndexInfo(data.values, lotInfo);
        if (parsed && parsed.rows && parsed.rows.length > 0) {
            console.log('Successfully parsed using index information');
            return parsed;
        }

        console.log('Primary parsing failed, trying alternative approach');
        const parsedAlt = parseMatrix(data.values, lotNumber);
        if (parsedAlt && parsedAlt.rows && parsedAlt.rows.length > 0) {
            console.log('Successfully parsed with alternative method');
            return parsedAlt;
        }

        throw new Error('Failed to parse data using both methods');

    } catch (err) {
        console.error('Error fetching using index:', err.message);
        throw err;
    }
}
// ============================
// Pending Zip Count Functions
// ============================
// ============================
// UPDATED Pending Zip Count Functions
// ============================
// ============================
// UPDATED Pending Zip Count Functions with Debugging
// ============================
async function fetchPendingZipCount(signal) {
    try {
        console.log('🔍 Fetching pending Zip data from Google Sheets...');
        const url = 'https://docs.google.com/spreadsheets/d/1sakbedDFEKimbF73mBsFU7OuCei4UqQt9PvXcpq6SB0/export?format=csv&gid=1773429271';

        console.log('📡 Fetching from URL:', url);
        const response = await fetch(url, { signal });

        if (!response.ok) {
            throw new Error(`Failed to fetch pending zip data: ${response.status}`);
        }

        const csvText = await response.text();
        const rows = parseCSVText(csvText);
        console.log('📊 Raw data received, total rows:', rows.length);

        if (rows.length < 2) {
            console.log('❌ No data found in ZipPurchaseOrders sheet');
            return { pendingLots: 0, totalPendingPieces: 0 };
        }

        const headers = rows[0].map(norm);
        console.log('📋 Sheet headers:', headers);

        // Find column indices for all relevant fields
        const materialEntryDateIndex = headers.findIndex(h =>
            includes(h, 'material entry date') || includes(h, 'material entry')
        );
        const supplierNameIndex = headers.findIndex(h =>
            includes(h, 'supplier name') || includes(h, 'supplier')
        );
        const lotNumberIndex = headers.findIndex(h =>
            includes(h, 'lot number') || includes(h, 'lot')
        );
        const totalPiecesIndex = headers.findIndex(h =>
            includes(h, 'total pieces') || includes(h, 'total pcs') || includes(h, 'total')
        );

        console.log('🔍 Column indices found:', {
            materialEntryDateIndex,
            supplierNameIndex,
            lotNumberIndex,
            totalPiecesIndex
        });

        // If we can't find the required columns, return 0
        if (lotNumberIndex === -1 || totalPiecesIndex === -1) {
            console.warn('❌ Required columns (Lot Number, Total Pieces) not found');
            return { pendingLots: 0, totalPendingPieces: 0 };
        }

        // Count lots where Material Entry Date is empty AND Supplier Name is empty
        let pendingLots = 0;
        let totalPendingPieces = 0;

        console.log('🔢 Processing rows...');
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i] || [];

            const lotNumber = norm(row[lotNumberIndex]);
            const totalPieces = parseInt(norm(row[totalPiecesIndex])) || 0;

            // Check if material entry date exists (if column exists)
            let hasMaterialEntryDate = false;
            if (materialEntryDateIndex !== -1) {
                const materialEntryDate = norm(row[materialEntryDateIndex]);
                hasMaterialEntryDate = !!materialEntryDate;
            }

            // Check if supplier name exists (if column exists)
            let hasSupplierName = false;
            if (supplierNameIndex !== -1) {
                const supplierName = norm(row[supplierNameIndex]);
                hasSupplierName = !!supplierName;
            }

            const isPending = lotNumber &&
                totalPieces > 0 &&
                (!hasMaterialEntryDate || !hasSupplierName);

            if (isPending) {
                pendingLots++;
                totalPendingPieces += totalPieces;
            }
        }

        console.log(`📈 Final counts - Pending lots: ${pendingLots}, Total pending pieces: ${totalPendingPieces}`);

        return {
            pendingLots,
            totalPendingPieces
        };
    } catch (error) {
        console.error('❌ Error fetching pending Zip count:', error);
        return { pendingLots: 0, totalPendingPieces: 0 };
    }
}
function parseMatrixWithIndexInfo(rows, lotInfo) {
    console.log('Parsing with index info:', lotInfo);
    console.log('Rows to parse:', rows);

    let lotNumber = lotInfo.lotNumber;
    let style = lotInfo.style || '';
    let fabric = lotInfo.fabric || '';
    let garmentType = lotInfo.garmentType || '';
    let brand = lotInfo.brand || '';
    let partyName = lotInfo.partyName || '';
    const headerCols = lotInfo.headerCols || 7;

    for (let i = 0; i < Math.min(rows.length, 12); i++) {
        const r = rows[i] || [];

        if (includes(r[0], 'lot number') && r[1]) {
            lotNumber = norm(r[1]);
            const idxStyle = r.findIndex((c) => includes(c, 'style'));
            if (idxStyle !== -1 && r[idxStyle + 1]) style = norm(r[idxStyle + 1]);
        }
        if (includes(r[0], 'fabric') && r[1]) {
            fabric = norm(r[1]);
            const idxGT = r.findIndex((c) => includes(c, 'garment type'));
            if (idxGT !== -1 && r[idxGT + 1]) garmentType = norm(r[idxGT + 1]);
            const idxBrand = r.findIndex((c) => includes(c, 'brand'));
            if (idxBrand !== -1 && r[idxBrand + 1]) brand = norm(r[idxBrand + 1]);
            const idxPartyName = r.findIndex((c) => includes(c, 'party name'));
            if (idxPartyName !== -1 && r[idxPartyName + 1]) partyName = norm(r[idxPartyName + 1]);
            // Removed season parsing
        }

        const styleIdx = r.findIndex(c => includes(c, 'style'));
        if (styleIdx !== -1 && r[styleIdx + 1] && !style) style = norm(r[styleIdx + 1]);

        const fabricIdx = r.findIndex(c => includes(c, 'fabric'));
        if (fabricIdx !== -1 && r[fabricIdx + 1] && !fabric) fabric = norm(r[fabricIdx + 1]);

        const garmentTypeIdx = r.findIndex(c => includes(c, 'garment type'));
        if (garmentTypeIdx !== -1 && r[garmentTypeIdx + 1] && !garmentType) garmentType = norm(r[garmentTypeIdx + 1]);

        const brandIdx = r.findIndex(c => includes(c, 'brand'));
        if (brandIdx !== -1 && r[brandIdx + 1] && !brand) brand = norm(r[brandIdx + 1]);

        const partyNameIdx = r.findIndex(c => includes(c, 'party name'));
        if (partyNameIdx !== -1 && r[partyNameIdx + 1] && !partyName) partyName = norm(r[partyNameIdx + 1]);

        // Removed season parsing
    }

    let headerIdx = -1;

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const r = rows[i] || [];

        const hasColor = r.some(c => includes(c, 'color'));
        const hasCT = r.some(c => includes(c, 'cutting table') || includes(c, 'table'));
        const hasSizes = r.some(c => !isNaN(parseFloat(c)) && isFinite(c));

        if ((hasColor && hasCT) || (hasColor && hasSizes) || (hasCT && hasSizes)) {
            headerIdx = i;
            console.log('Found header at row:', i);
            break;
        }
    }

    if (headerIdx === -1) {
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const r = rows[i] || [];
            const textCols = r.filter(c => typeof c === 'string' && c.trim().length > 2);
            const numberCols = r.filter(c => !isNaN(parseFloat(c)) && isFinite(c));
            if (textCols.length >= 2 && numberCols.length >= 2) { headerIdx = i; break; }
        }
        if (headerIdx === -1) {
            for (let i = 0; i < Math.min(rows.length, 10); i++) {
                const r = rows[i] || [];
                if (r.some(cell => norm(cell))) { headerIdx = i; break; }
            }
        }
    }

    if (headerIdx === -1) {
        console.error('Could not find header row in provided data');
        return null;
    }

    const header = rows[headerIdx].map(norm);

    let idxColor = header.findIndex(c => includes(c, 'color'));
    let idxCT = header.findIndex(c => includes(c, 'cutting table') || includes(c, 'table'));
    let idxTotal = header.findIndex(c => includes(c, 'total'));

    if (idxColor === -1) {
        for (let i = 0; i < header.length; i++) {
            if (header[i] && typeof header[i] === 'string' && header[i].length > 2) { idxColor = i; break; }
        }
    }
    if (idxCT === -1) {
        for (let i = (idxColor !== -1 ? idxColor + 1 : 0); i < header.length; i++) {
            if (header[i] && (includes(header[i], 'table') || includes(header[i], 'ct'))) { idxCT = i; break; }
        }
        if (idxCT === -1 && idxColor !== -1) idxCT = idxColor + 1;
    }

    const sizeCols = [];
    const startIdx = idxCT !== -1 ? idxCT + 1 : idxColor !== -1 ? idxColor + 1 : 0;
    const endIdx = idxTotal !== -1 ? idxTotal : Math.min(header.length, headerCols);

    for (let i = startIdx; i < endIdx; i++) {
        const colName = norm(header[i]);
        if (colName && !includes(colName, 'total') && !includes(colName, 'alter') && !includes(colName, 'pcs')) {
            sizeCols.push({ key: colName, index: i });
        } else if (!colName) {
            sizeCols.push({ key: `Size${i - startIdx + 1}`, index: i });
        }
    }

    if (sizeCols.length === 0) {
        for (let i = startIdx; i < endIdx; i++) {
            for (let j = headerIdx + 1; j < Math.min(headerIdx + 5, rows.length); j++) {
                const cellValue = rows[j]?.[i];
                if (cellValue && !isNaN(parseFloat(cellValue)) && isFinite(cellValue)) {
                    const colName = norm(header[i]) || `Size${i - startIdx + 1}`;
                    sizeCols.push({ key: colName, index: i });
                    break;
                }
            }
        }
    }

    if (sizeCols.length === 0) {
        console.error('No size columns found');
        return null;
    }

    const sizeKeys = sizeCols.map(s => s.key);

    const allColors = new Set();
    for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const color = idxColor !== -1 && row[idxColor] !== undefined ? norm(row[idxColor]) : '';
        if (color && !includes(color, 'total')) allColors.add(color);
    }

    const body = [];
    for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const color = idxColor !== -1 && row[idxColor] !== undefined ? norm(row[idxColor]) : '';
        if (!color) { if (body.length > 0) break; continue; }
        if (includes(color, 'total')) break;

        const cuttingTable = idxCT !== -1 && row[idxCT] !== undefined ? toNumOrNull(row[idxCT]) : null;

        const sizeMap = {};
        let rowTotal = 0;
        let hasData = false;

        for (const s of sizeCols) {
            const qty = row[s.index] !== undefined ? toNumOrNull(row[s.index]) : null;
            sizeMap[s.key] = qty;
            if (qty !== null) { rowTotal += qty; hasData = true; }
        }

        if (hasData) {
            const explicitTotal = idxTotal !== -1 && row[idxTotal] !== undefined ? toNumOrNull(row[idxTotal]) : null;
            const totalPcs = explicitTotal ?? rowTotal;
            body.push({ color, cuttingTable, sizes: sizeMap, totalPcs });
        }
    }

    if (allColors.size > body.length) {
        const existingColors = new Set(body.map(row => row.color));
        const missing = Array.from(allColors).filter(c => !existingColors.has(c));
        for (const color of missing) {
            const sizeMap = {};
            for (const s of sizeCols) sizeMap[s.key] = null;
            body.push({ color, cuttingTable: null, sizes: sizeMap, totalPcs: 0 });
        }
    }

    body.sort((a, b) => a.color.localeCompare(b.color));

    if (body.length === 0) return null;

    const totals = { perSize: {}, grand: 0 };
    for (const k of sizeKeys) totals.perSize[k] = 0;
    for (const row of body) {
        for (const k of sizeKeys) totals.perSize[k] += row.sizes[k] ?? 0;
        totals.grand += row.totalPcs ?? 0;
    }

    return {
        lotNumber,
        style,
        fabric,
        garmentType,
        brand,
        partyName,
        sizes: sizeKeys,
        rows: body,
        totals
    };
}

async function searchInCuttingSheet(lotNo, signal) {
    console.log('Searching in Cutting sheet (fallback)');

    const range = encodeURIComponent('Cutting!A1:Z');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;
    const res = await fetch(url, { signal });

    if (!res.ok) throw new Error(`Failed to access Cutting sheet: ${res.status}`);

    const data = await res.json();
    if (!data?.values?.length) throw new Error('Cutting sheet is empty');

    const values = data.values;
    const section = sliceSectionForLot(values, lotNo);

    if (section?.length) {
        const parsed = parseMatrix(section, lotNo);
        if (parsed && parsed.rows.length) {
            return parsed;
        }
    }

    throw new Error('Lot not found in Cutting sheet');
}

function sliceSectionForLot(values, lotNo) {
    const rows = values;
    let start = -1;

    for (let i = 0; i < Math.min(rows.length, 200); i++) {
        const line = (rows[i] || []).join(' ');
        if (includes(line, 'cutting matrix') && includes(line, `lot ${lotNo}`)) { start = i; break; }
    }
    if (start === -1) {
        for (let i = 0; i < Math.min(rows.length, 200); i++) {
            const r = rows[i] || [];
            if (includes(r[0], 'lot number') && norm(r[1]) === norm(lotNo)) { start = Math.max(0, i - 1); break; }
        }
    }
    if (start === -1) return null;
    return rows.slice(start, Math.min(start + 80, rows.length));
}

const valOrEmpty = v => (v == null || v === 0 || v === '0' ? '' : v);

function toNumOrNull(v) {
    const t = norm(v);
    if (t === '') return null;
    const n = parseFloat(t.replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : null;
}

function parseMatrix(rows, lotNo) {
    let lotNumber = norm(lotNo);
    let style = '';
    let fabric = '';
    let garmentType = '';
    let brand = '';
    let partyName = '';
    let season = '';

    for (let i = 0; i < Math.min(rows.length, 12); i++) {
        const r = rows[i] || [];
        if (includes(r[0], 'lot number')) {
            if (r[1]) lotNumber = norm(r[1]);
            const idxStyle = r.findIndex((c) => includes(c, 'style'));
            if (idxStyle !== -1 && r[idxStyle + 1]) style = norm(r[idxStyle + 1]);
        }
        if (includes(r[0], 'fabric')) {
            if (r[1]) fabric = norm(r[1]);
            const idxGT = r.findIndex((c) => includes(c, 'garment type'));
            if (idxGT !== -1 && r[idxGT + 1]) garmentType = norm(r[idxGT + 1]);
            const idxBrand = r.findIndex((c) => includes(c, 'brand'));
            if (idxBrand !== -1 && r[idxBrand + 1]) brand = norm(r[idxBrand + 1]);
            const idxPartyName = r.findIndex((c) => includes(c, 'party name'));
            if (idxPartyName !== -1 && r[idxPartyName + 1]) partyName = norm(r[idxPartyName + 1]);
            const idxSeason = r.findIndex((c) => includes(c, 'season'));
            if (idxSeason !== -1 && r[idxSeason + 1]) season = norm(r[idxSeason + 1]);
        }

        const styleIdx = r.findIndex(c => includes(c, 'style'));
        if (styleIdx !== -1 && r[styleIdx + 1] && !style) style = norm(r[styleIdx + 1]);

        const fabricIdx = r.findIndex(c => includes(c, 'fabric'));
        if (fabricIdx !== -1 && r[fabricIdx + 1] && !fabric) fabric = norm(r[fabricIdx + 1]);

        const garmentTypeIdx = r.findIndex(c => includes(c, 'garment type'));
        if (garmentTypeIdx !== -1 && r[garmentTypeIdx + 1] && !garmentType) garmentType = norm(r[garmentTypeIdx + 1]);

        const brandIdx = r.findIndex(c => includes(c, 'brand'));
        if (brandIdx !== -1 && r[brandIdx + 1] && !brand) brand = norm(r[brandIdx + 1]);

        const partyNameIdx = r.findIndex(c => includes(c, 'party name'));
        if (partyNameIdx !== -1 && r[partyNameIdx + 1] && !partyName) partyName = norm(r[partyNameIdx + 1]);

        const seasonIdx = r.findIndex(c => includes(c, 'season'));
        if (seasonIdx !== -1 && r[seasonIdx + 1] && !season) season = norm(r[seasonIdx + 1]);
    }

    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i] || [];
        const hasColor = r.some((c) => includes(c, 'color'));
        const hasCT = r.some((c) => includes(c, 'cutting table'));
        if (hasColor && hasCT) { headerIdx = i; break; }
    }
    if (headerIdx === -1) {
        return {
            lotNumber,
            style,
            fabric,
            garmentType,
            brand,
            partyName,
            season,
            sizes: [],
            rows: [],
            totals: { perSize: {}, grand: 0 }
        };
    }

    const header = rows[headerIdx].map(norm);
    const idxColor = header.findIndex((c) => includes(c, 'color'));
    const idxCT = header.findIndex((c) => includes(c, 'cutting table'));
    const idxTotal = header.findIndex((c) => includes(c, 'total'));

    const sizeCols = [];
    for (let i = idxCT + 1; i < header.length; i++) {
        if (i === idxTotal) break;
        if (norm(header[i])) sizeCols.push({ key: header[i], index: i });
    }
    const sizeKeys = sizeCols.map((s) => s.key);

    const allColors = new Set();
    for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const color = norm(row[idxColor]);
        if (color && !includes(color, 'total')) allColors.add(color);
    }

    const body = [];
    for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const first = norm(row[idxColor]);
        if (!first) { if (body.length) break; continue; }
        if (includes(first, 'total')) break;

        const color = first;
        const cuttingTable = toNumOrNull(row[idxCT]);
        const sizeMap = {};
        let rowTotal = 0;
        for (const s of sizeCols) {
            const qty = toNumOrNull(row[s.index]);
            sizeMap[s.key] = qty;
            rowTotal += (qty ?? 0);
        }
        const explicitTotal = idxTotal !== -1 ? toNumOrNull(row[idxTotal]) : null;
        const totalPcs = explicitTotal ?? rowTotal;
        body.push({ color, cuttingTable, sizes: sizeMap, totalPcs });
    }

    if (allColors.size > body.length) {
        const existingColors = new Set(body.map(row => row.color));
        const missingColors = Array.from(allColors).filter(color => !existingColors.has(color));
        for (const color of missingColors) {
            const sizeMap = {};
            for (const s of sizeCols) sizeMap[s.key] = null;
            body.push({ color, cuttingTable: null, sizes: sizeMap, totalPcs: 0 });
        }
    }

    body.sort((a, b) => a.color.localeCompare(b.color));

    const totals = { perSize: {}, grand: 0 };
    for (const k of sizeKeys) totals.perSize[k] = 0;
    for (const row of body) {
        for (const k of sizeKeys) totals.perSize[k] += row.sizes[k] ?? 0;
        totals.grand += row.totalPcs ?? 0;
    }

    return {
        lotNumber,
        style,
        fabric,
        garmentType,
        brand,
        partyName,
        season,
        sizes: sizeKeys,
        rows: body,
        totals
    };
}

function printableDate(d) {
    if (!d) return '—';
    try {
        const dt = new Date(d);
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const yy = String(dt.getFullYear()).slice(-2);
        return `${dd}.${mm}.${yy}`;
    } catch { return d; }
}

// ============================
// Simple QR Code Functions for Your AppScript
// ============================
const generateSimpleQR = async (lotNumber) => {
    try {
        // Fetch server local IP address dynamically
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

        // Generate QR URLs for your simple AppScript
        const gateEntryQRUrl = `${localSystemUrl}?action=gateForm&lot=${encodeURIComponent(lotNumber)}&poType=zip`;
        const materialInQRUrl = `${localSystemUrl}?action=materialForm&lot=${encodeURIComponent(lotNumber)}&poType=zip`;
        const supplierQRUrl = `${localSystemUrl}?action=supplierForm&lot=${encodeURIComponent(lotNumber)}&poType=zip`;

        // Generate QR code images
        const gateQRImage = await QRCode.toDataURL(gateEntryQRUrl, {
            width: 120,
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        const materialQRImage = await QRCode.toDataURL(materialInQRUrl, {
            width: 120,
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        const supplierQRImage = await QRCode.toDataURL(supplierQRUrl, {
            width: 120,
            margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' }
        });

        return {
            gateEntry: {
                url: gateEntryQRUrl,
                image: gateQRImage
            },
            materialIn: {
                url: materialInQRUrl,
                image: materialQRImage
            },
            supplierEntry: {
                url: supplierQRUrl,
                image: supplierQRImage
            }
        };
    } catch (error) {
        console.error('Error generating QR codes:', error);
        return null;
    }
};

const saveOrderToSheet = async (matrix, formData, totalCost) => {
    try {
        // Extract blockedShades from formData or use empty Set as fallback
        const blockedShades = formData.blockedShades || new Set();

        // Filter out blocked shades from the submission
        const filteredZipSelections = { ...formData.zipSelections };
        blockedShades.forEach(color => {
            delete filteredZipSelections[color];
        });

        // Calculate selected shades total pieces (excluding blocked ones)
        let selectedShadesTotalPieces = 0;
        if (filteredZipSelections && matrix.rows) {
            const filteredRows = matrix.rows.filter(row => {
                const color = row.color || '';
                const zipColor = filteredZipSelections[color] || '';
                return zipColor && zipColor.trim() !== '' && !blockedShades.has(color);
            });

            selectedShadesTotalPieces = filteredRows.reduce((sum, row) => sum + (row.totalPcs || 0), 0);

            console.log(`📊 Selected ${filteredRows.length} out of ${matrix.rows.length} colors (excluding ${blockedShades.size} blocked shades)`);
        }

        const orderData = {
            matrix: {
                lotNumber: matrix.lotNumber || '',
                garmentType: matrix.garmentType || '',
                style: matrix.style || '',
                fabric: matrix.fabric || '',
                totals: {
                    grand: selectedShadesTotalPieces
                },
                rows: (matrix.rows || []).map(row => ({
                    color: row.color || '',
                    totalPcs: row.totalPcs || 0,
                    sizes: row.sizes || {}
                }))
            },
            issueDate: formData.issueDate || '',
            supervisor: formData.supervisor || '',
            priority: formData.priority || 'Normal',
            zipSelections: filteredZipSelections, // Use filtered selections
            selectedPlacements: formData.selectedPlacements || [],
            placementQuantities: formData.placementQuantities || {},
            placementZipTypes: formData.placementZipTypes || {},
            zipQualityData: formData.zipQualityData || [],
            totalCost: totalCost || 0,
            selectedShadesTotalPieces: selectedShadesTotalPieces,
            blockedShadesCount: blockedShades.size // Send count for tracking
        };

        console.log('📤 Sending zip order data to Google Sheets:', orderData);

        const response = await fetch(QR_SYSTEM_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify(orderData),
        });

        const result = await response.text();

        if (result.includes('SUCCESS')) {
            console.log('✅ Zip order data stored successfully');
            console.log(`📦 Stored ${selectedShadesTotalPieces} pieces (excluding ${blockedShades.size} blocked shades)`);
            return {
                success: true,
                message: result,
                selectedShadesTotalPieces: selectedShadesTotalPieces,
                blockedShadesCount: blockedShades.size
            };
        } else {
            console.error('❌ Failed to store zip order data:', result);
            return { success: false, message: result };
        }

    } catch (error) {
        console.error('❌ Network error storing zip order data:', error);
        return { success: false, message: error.message };
    }
};
// ============================
// Optimized React Component
// ============================
// eslint-disable-next-line react-refresh/only-export-components
export const generateIssuePdf = async (matrix, {
    issueDate,
    supervisor,
    priority,
    zipSelections,
    selectedPlacements,
    placementQuantities,
    placementZipTypes,
    zipQualityData,
    blockedShades,
    poNumber
}) => {
    if (!matrix) return;

    const line = 0.9;

    function printableDate(d) {
        if (!d) return '';
        const dt = new Date(d);
        if (isNaN(dt)) return String(d);
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const yyyy = dt.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    function filenameDatePart(d) {
        if (!d) return 'unknown';
        const dt = new Date(d);
        if (isNaN(dt)) return 'unknown';
        return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
    }

    function cleanString(v) {
        return typeof norm === 'function' ? norm(v) : (v || '');
    }

    function parsePrice(v) {
        if (typeof v === 'number') return v;
        if (typeof v !== 'string') return 0;

        let cleaned = v.replace(/[^\d.]/g, '');
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            cleaned = parts[0] + '.' + parts[1];
        } else if (parts.length === 1) {
            cleaned = parts[0];
        }

        const result = parseFloat(cleaned);
        return isNaN(result) ? 0 : result;
    }

    function formatPlainNumber(n) {
        const num = Number(n || 0);
        return num.toLocaleString('en-IN');
    }

    const getZipPricePdf = (zipType, color) => {
        if (!zipType || !color || !zipQualityData) return 0;

        try {
            const normalizedType = cleanString(zipType).toLowerCase();
            const normalizedColor = cleanString(color).toLowerCase();

            const item = zipQualityData.find(item =>
                cleanString(item.type).toLowerCase() === normalizedType &&
                cleanString(item.color).toLowerCase() === normalizedColor
            );

            return item ? parsePrice(item.price) : 0;
        } catch (error) {
            console.error('Error getting zip price:', error);
            return 0;
        }
    };

    // Generate simple QR codes for your AppScript
    const qrCodes = await generateSimpleQR(matrix.lotNumber);

    // Fetch pending zip count and total pending pieces with proper error handling
    let pendingData = { pendingLots: 0, totalPendingPieces: 0 };
    try {
        const pendingResult = await fetchPendingZipCount();
        pendingData = {
            pendingLots: pendingResult?.pendingLots || 0,
            totalPendingPieces: pendingResult?.totalPendingPieces || 0
        };
        console.log(`Pending lots: ${pendingData.pendingLots}, Total pending pieces: ${pendingData.totalPendingPieces}`);
    } catch (error) {
        console.error('Failed to fetch pending data:', error);
        pendingData = { pendingLots: 0, totalPendingPieces: 0 };
    }

    // Calculate selected pieces (excluding blocked shades)
    const selectedRows = matrix.rows.filter(row => {
        const color = row.color || '';
        const zipColor = zipSelections[color] || '';
        return zipColor && zipColor.trim() !== '' && !blockedShades.has(color);
    });

    const selectedTotalPieces = selectedRows.reduce((sum, row) => sum + (row.totalPcs || 0), 0);

    console.log(`📊 PDF: Showing ${selectedTotalPieces} selected pieces instead of ${matrix.totals.grand} total pieces`);

    const doc = new jsPDF({ unit: 'pt', format: 'A4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    const M = 18;
    const borderPad = 6;
    doc.setDrawColor(0); doc.setTextColor(0); doc.setLineWidth(line);
    const borderX = 8, borderY = 8, borderW = W - 16, borderH = H - 16;

    // Function to draw header (reusable for multiple pages)
    const drawHeader = () => {
        // Draw outer border
        doc.rect(borderX, borderY, borderW, borderH);

        const CM = M + borderPad;
        const contentWidth = W - (CM * 2);

        // --- Simple QR Codes in Boxes ---
        const boxY = borderY + 20;
        const boxSize = 80;
        const centerPoint = borderX + borderW / 2;

        // Box 1 - GATE ENTRY QR
        const box1X = CM;
        doc.rect(box1X, boxY, boxSize, boxSize);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.text('SCAN FOR', box1X + boxSize / 2, boxY + 10, { align: 'center' });
        doc.text('GATE ENTRY', box1X + boxSize / 2, boxY + 20, { align: 'center' });

        if (qrCodes && qrCodes.gateEntry.image) {
            doc.addImage(qrCodes.gateEntry.image, 'PNG', box1X + 10, boxY + 25, boxSize - 20, boxSize - 35);
        } else {
            doc.rect(box1X + 10, boxY + 25, boxSize - 20, boxSize - 35);
            doc.setFontSize(6);
            doc.text('QR CODE', box1X + boxSize / 2, boxY + boxSize / 2 + 5, { align: 'center' });
            doc.text('GATE ENTRY', box1X + boxSize / 2, boxY + boxSize / 2 + 15, { align: 'center' });
        }

        // Box 2 - MATERIAL IN QR
        const box2X = CM + contentWidth - boxSize;
        doc.rect(box2X, boxY, boxSize, boxSize);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.text('SCAN FOR', box2X + boxSize / 2, boxY + 10, { align: 'center' });
        doc.text('MATERIAL IN', box2X + boxSize / 2, boxY + 20, { align: 'center' });

        if (qrCodes && qrCodes.materialIn.image) {
            doc.addImage(qrCodes.materialIn.image, 'PNG', box2X + 10, boxY + 25, boxSize - 20, boxSize - 35);
        } else {
            doc.rect(box2X + 10, boxY + 25, boxSize - 20, boxSize - 35);
            doc.setFontSize(6);
            doc.text('QR CODE', box2X + boxSize / 2, boxY + boxSize / 2 + 5, { align: 'center' });
            doc.text('MATERIAL IN', box2X + boxSize / 2, boxY + boxSize / 2 + 15, { align: 'center' });
        }

        const headerTitleY = boxY + 20;

        doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
        doc.text('PURCHASE ORDER', centerPoint, headerTitleY, { align: 'center' });

        doc.setFontSize(14);
        doc.text('ZIP MATERIAL REQUIREMENT', centerPoint, headerTitleY + 20, { align: 'center' });

        const lotNumberText = cleanString(matrix.lotNumber || 'LOT NO. UNKNOWN');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(`LOT NO: ${lotNumberText}`, centerPoint, headerTitleY + 40, { align: 'center' });

        // Show PO Number prominently
        if (poNumber) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(0, 80, 180);
            doc.text(`PO NO: ${poNumber}`, centerPoint, headerTitleY + 58, { align: 'center' });
            doc.setTextColor(0);
        }

        const fieldsY = boxY + boxSize + 15;
        const fieldH = 20;

        // Line 1: DATE, ITEM
        const dateItemW = (contentWidth / 2) - 1;
        const dateItemX = CM;

        doc.rect(dateItemX, fieldsY, dateItemW, fieldH);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text('DATE :', dateItemX + 4, fieldsY + 12);
        doc.setFont('helvetica', 'normal');
        doc.text(printableDate(issueDate), dateItemX + 35, fieldsY + 12);

        doc.rect(dateItemX + dateItemW, fieldsY, dateItemW, fieldH);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text('ITEM :', dateItemX + dateItemW + 4, fieldsY + 12);
        doc.setFont('helvetica', 'normal');
        doc.text(cleanString(matrix.garmentType || matrix.style || ''), dateItemX + dateItemW + 35, fieldsY + 12);

        // Line 2: TOTAL PCS (SELECTED), PRIORITY - UPDATED TO SHOW SELECTED PIECES
        const pcsPriorityX = CM;

        doc.rect(pcsPriorityX, fieldsY + fieldH, dateItemW, fieldH);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text('TOTAL PCS', pcsPriorityX + 4, fieldsY + fieldH + 12);
        doc.setFont('helvetica', 'normal');
        // Show selected pieces instead of complete lot total
        doc.text(selectedTotalPieces.toString(), pcsPriorityX + 60, fieldsY + fieldH + 12);

        doc.rect(pcsPriorityX + dateItemW, fieldsY + fieldH, dateItemW, fieldH);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text('PRIORITY', pcsPriorityX + dateItemW + 4, fieldsY + fieldH + 12);
        doc.setFont('helvetica', 'normal');
        doc.text(cleanString(priority ?? 'Normal'), pcsPriorityX + dateItemW + 50, fieldsY + fieldH + 12);

        // Line 3: BRAND, SUPERVISOR
        const brandSupervisorX = CM;

        doc.rect(brandSupervisorX, fieldsY + (fieldH * 2), dateItemW, fieldH);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text('BRAND :', brandSupervisorX + 4, fieldsY + (fieldH * 2) + 12);
        doc.setFont('helvetica', 'normal');
        doc.text(cleanString(matrix.brand || ''), brandSupervisorX + 45, fieldsY + (fieldH * 2) + 12);

        doc.rect(brandSupervisorX + dateItemW, fieldsY + (fieldH * 2), dateItemW, fieldH);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text('SUPERVISOR : ', brandSupervisorX + dateItemW + 4, fieldsY + (fieldH * 2) + 12);
        doc.setFont('helvetica', 'normal');
        doc.text(cleanString(supervisor ?? '________'), brandSupervisorX + dateItemW + 65, fieldsY + (fieldH * 2) + 12);

        const dividingLineY = fieldsY + (fieldH * 3) + 5;
        doc.setLineWidth(1.5);
        doc.setDrawColor(0);
        doc.line(CM, dividingLineY, CM + contentWidth, dividingLineY);
        doc.setLineWidth(line);

        return {
            CM,
            contentWidth,
            breakdownStartY: dividingLineY + 15
        };
    };

    // Function to draw simple footer with page number
    const drawSimpleFooter = (currentPage, pageCount) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Page ${currentPage} of ${pageCount}`, W / 2, H - 10, { align: 'center' });
    };

    const drawFooterWithSignatures = () => {
        const CM = M + borderPad;
        const contentWidth = W - (CM * 2);

        const signatureSectionHeight = 130;
        const signatureSectionY = H - signatureSectionHeight;

        const signatureBoxWidth = 150;
        const signatureBoxHeight = 50;
        const signatureSpacing = (contentWidth - (signatureBoxWidth * 3)) / 2;
        const boxPad = 5;

        doc.setLineWidth(line);
        doc.setDrawColor(0);
        doc.setTextColor(0);

        const drawSignatureBox = (x, label) => {
            doc.rect(x, signatureSectionY, signatureBoxWidth, signatureBoxHeight);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
            doc.text(label, x + boxPad, signatureSectionY + 10);

            doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
            doc.text('NAME:', x + boxPad, signatureSectionY + 28);
            doc.line(x + 35, signatureSectionY + 28, x + signatureBoxWidth - boxPad, signatureSectionY + 28);

            doc.text('DATE:', x + boxPad, signatureSectionY + 43);
            doc.line(x + 35, signatureSectionY + 43, x + signatureBoxWidth - boxPad, signatureSectionY + 43);
        };

        const supervisorBoxX = CM;
        drawSignatureBox(supervisorBoxX, 'SUPERVISOR SIGN');

        const supplierBoxX = supervisorBoxX + signatureBoxWidth + signatureSpacing;
        drawSignatureBox(supplierBoxX, 'SUPPLIER SIGN');

        const receiverBoxX = supplierBoxX + signatureBoxWidth + signatureSpacing;
        drawSignatureBox(receiverBoxX, 'RECEIVER SIGN');

        // Pending Status Box
        const pendingBoxWidth = 140;
        const pendingBoxHeight = 50;
        const pendingBoxX = receiverBoxX;
        const pendingBoxY = signatureSectionY - 55;

        doc.setDrawColor(0);
        doc.setLineWidth(line);
        doc.rect(pendingBoxX, pendingBoxY, pendingBoxWidth, pendingBoxHeight);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text('PENDING STATUS', pendingBoxX + pendingBoxWidth / 2, pendingBoxY + 8, { align: 'center' });

        doc.setLineWidth(0.5);
        doc.line(pendingBoxX + 5, pendingBoxY + 12, pendingBoxX + pendingBoxWidth - 5, pendingBoxY + 12);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('PENDING LOTS:', pendingBoxX + 8, pendingBoxY + 22);
        doc.setFontSize(11);
        doc.text(`${pendingData.pendingLots || 0}`, pendingBoxX + pendingBoxWidth - 8, pendingBoxY + 22, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('PENDING PIECES:', pendingBoxX + 8, pendingBoxY + 35);
        doc.setFontSize(10);
        doc.text(`${(pendingData.totalPendingPieces || 0).toLocaleString()}`, pendingBoxX + pendingBoxWidth - 8, pendingBoxY + 35, { align: 'right' });

        const instructionsY = signatureSectionY + signatureBoxHeight + 15;
        const centerX = CM + contentWidth / 2;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text('QR CODE USAGE INSTRUCTIONS:', centerX, instructionsY, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('• LEFT QR: Scan when material enters the gate - updates Gate Entry Person & Date', centerX, instructionsY + 12, { align: 'center' });
        doc.text('• RIGHT QR: Scan when material is received - updates Material Received status & Date', centerX, instructionsY + 24, { align: 'center' });
    };

    const { CM, contentWidth, breakdownStartY } = drawHeader();

    let finalContentY = breakdownStartY;

    const signatureSectionHeight = 120;
    const maxContentHeight = H - signatureSectionHeight - 50;

    // Variables for summary data - NOW USING SELECTED ROWS ONLY
    let summaryData = [];
    let totalZipCost = 0;
    let currentPage = 1;
    let pageCount = 1;

    if (matrix && selectedRows.length > 0 && selectedPlacements.length > 0 && zipSelections) {
        const zipHead = [['ZIP TYPE', 'PLACEMENT', 'COLOUR', 'ZIP COLOUR', 'QUANTITY', 'PRICE', 'TOTAL']];

        const zipBody = [];
        totalZipCost = 0;

        // Create a map to aggregate quantities by zip type - USING SELECTED ROWS ONLY
        const zipTypeSummary = {};

        selectedPlacements.forEach(placement => {
            const placementQuantity = placementQuantities[placement] || 1;
            const zipType = placementZipTypes[placement];

            if (zipType) {
                // Use selectedRows instead of matrix.rows
                selectedRows.forEach(row => {
                    const color = row.color;
                    if (!color) return;

                    const zipColor = zipSelections[color];
                    if (zipColor) {
                        const price = getZipPricePdf(zipType, zipColor);
                        const quantity = parseInt(row.totalPcs) || 0;
                        const requiredQuantity = quantity * placementQuantity;
                        const rowTotal = price * requiredQuantity;
                        totalZipCost += rowTotal;

                        // Aggregate for summary
                        if (!zipTypeSummary[zipType]) {
                            zipTypeSummary[zipType] = 0;
                        }
                        zipTypeSummary[zipType] += requiredQuantity;

                        if (requiredQuantity > 0) {
                            zipBody.push([
                                zipType,
                                `${placement} (${placementQuantity} per pc)`,
                                color,
                                zipColor,
                                requiredQuantity.toString(),
                                formatPlainNumber(price),
                                formatPlainNumber(rowTotal)
                            ]);
                        }
                    }
                });
            }
        });

        // Convert summary map to array for display
        summaryData = Object.entries(zipTypeSummary).map(([zipType, totalQuantity]) => ({
            zipType,
            totalQuantity
        }));

        if (zipBody.length > 0) {
            const zipFoot = [[
                '', '', '', '', '', 'Total:',
                formatPlainNumber(totalZipCost)
            ]];

            const zipColStyles = {
                0: { cellWidth: 120, halign: 'left' },
                1: { cellWidth: 120, halign: 'left' },
                2: { cellWidth: 70, halign: 'center' },
                3: { cellWidth: 80, halign: 'center' },
                4: { cellWidth: 60, halign: 'center' },
                5: { cellWidth: 50, halign: 'center' },
                6: { cellWidth: 50, halign: 'right' }
            };

            autoTable(doc, {
                head: zipHead,
                body: zipBody,
                foot: zipFoot,
                startY: breakdownStartY,
                theme: 'grid',
                tableWidth: contentWidth,
                margin: { top: breakdownStartY, left: CM, right: CM, bottom: 50 },
                pageBreak: 'auto',
                styles: {
                    font: 'helvetica',
                    fontSize: 9,
                    textColor: [0, 0, 0],
                    lineColor: [0, 0, 0],
                    lineWidth: line,
                    cellPadding: 4,
                    halign: 'left',
                },
                headStyles: {
                    fillColor: [240, 240, 240],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    halign: 'center'
                },
                footStyles: {
                    fillColor: [240, 240, 240],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    halign: 'right'
                },
                columnStyles: zipColStyles,
                didDrawPage: function (data) {
                    currentPage = data.pageNumber;
                    pageCount = data.pageCount;

                    if (currentPage < pageCount) {
                        drawSimpleFooter(currentPage, pageCount);
                    }

                    if (data.pageNumber > 1) {
                        drawHeader();
                        drawSimpleFooter(currentPage, pageCount);
                    }
                }
            });

            finalContentY = doc.lastAutoTable.finalY + 20;

            // Draw summary box below the table - NOW SHOWS SELECTED PIECES TOTAL
            if (summaryData.length > 0) {
                const summaryBoxWidth = contentWidth;
                const summaryBoxHeight = Math.max(80, summaryData.length * 20 + 50);

                if (finalContentY + summaryBoxHeight > H - signatureSectionHeight - 20) {
                    doc.addPage();
                    currentPage++;
                    pageCount++;
                    drawHeader();
                    drawSimpleFooter(currentPage, pageCount);
                    finalContentY = breakdownStartY;
                }

                const summaryBoxX = CM;
                const summaryBoxY = finalContentY;

                doc.setDrawColor(0);
                doc.setLineWidth(line);
                doc.rect(summaryBoxX, summaryBoxY, summaryBoxWidth, summaryBoxHeight);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.text('ZIP TYPE SUMMARY', summaryBoxX + summaryBoxWidth / 2, summaryBoxY + 20, { align: 'center' });

                doc.setLineWidth(0.8);
                doc.line(summaryBoxX + 10, summaryBoxY + 30, summaryBoxX + summaryBoxWidth - 10, summaryBoxY + 30);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);

                let summaryContentY = summaryBoxY + 50;
                const columnWidth = summaryBoxWidth / 2;

                summaryData.forEach((item, index) => {
                    const rowY = summaryContentY + (index * 20);
                    doc.text(`${item.zipType}:`, summaryBoxX + 20, rowY);
                    doc.text(`${item.totalQuantity.toLocaleString()}`, summaryBoxX + summaryBoxWidth - 20, rowY, { align: 'right' });
                });

                // Total line - NOW SHOWS SELECTED PIECES GRAND TOTAL
                const totalQuantity = summaryData.reduce((sum, item) => sum + item.totalQuantity, 0);
                const totalY = summaryContentY + (summaryData.length * 20) + 10;

                doc.setLineWidth(0.8);
                doc.line(summaryBoxX + 10, totalY, summaryBoxX + summaryBoxWidth - 10, totalY);

                doc.setFont('helvetica', 'bold');
                doc.text('GRAND TOTAL OF ZIP PCS:', summaryBoxX + 20, totalY + 18);
                doc.text(`${totalQuantity.toLocaleString()}`, summaryBoxX + summaryBoxWidth - 20, totalY + 18, { align: 'right' });

                finalContentY = summaryBoxY + summaryBoxHeight + 20;

                // ADD SUPPLIER QR BELOW THE SUMMARY BOX
                const supplierQRSize = 80;
                const supplierQRX = CM + (contentWidth - supplierQRSize) / 2;
                const supplierQRY = finalContentY + 20;

                doc.rect(supplierQRX, supplierQRY, supplierQRSize, supplierQRSize);

                doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
                doc.text('SCAN FOR', supplierQRX + supplierQRSize / 2, supplierQRY + 10, { align: 'center' });
                doc.text('SUPPLIER ENTRY', supplierQRX + supplierQRSize / 2, supplierQRY + 20, { align: 'center' });

                if (qrCodes && qrCodes.supplierEntry.image) {
                    doc.addImage(qrCodes.supplierEntry.image, 'PNG', supplierQRX + 10, supplierQRY + 25, supplierQRSize - 20, supplierQRSize - 35);
                } else {
                    doc.rect(supplierQRX + 10, supplierQRY + 25, supplierQRSize - 20, supplierQRSize - 35);
                    doc.setFontSize(6);
                    doc.text('QR CODE', supplierQRX + supplierQRSize / 2, supplierQRY + supplierQRSize / 2 + 5, { align: 'center' });
                    doc.text('SUPPLIER ENTRY', supplierQRX + supplierQRSize / 2, supplierQRY + supplierQRSize / 2 + 15, { align: 'center' });
                }

                finalContentY = supplierQRY + supplierQRSize + 20;
            }

        } else {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
            doc.text('No zip cost breakdown available', CM, breakdownStartY + 10);
            finalContentY = breakdownStartY + 30;
        }
    } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.text('No zip cost breakdown available', CM, breakdownStartY + 10);
        finalContentY = breakdownStartY + 30;
    }

    // Draw final footer with signatures and QR instructions on the last page
    drawFooterWithSignatures();
    drawSimpleFooter(currentPage, pageCount);

    const fname = poNumber
        ? `${poNumber}_Lot_${cleanString(matrix.lotNumber || 'Unknown')}_${filenameDatePart(issueDate)}.pdf`
        : `Lot_${cleanString(matrix.lotNumber || 'Unknown')}_Purchase_Order_${filenameDatePart(issueDate)}.pdf`;
    doc.save(fname);

    // Save order data to Google Sheets
    const saveResult = await saveOrderToSheet(
        matrix,
        {
            issueDate,
            supervisor,
            priority,
            zipSelections,
            selectedPlacements,
            placementQuantities,
            placementZipTypes,
            zipQualityData,
            blockedShades
        },
        totalZipCost
    );

    return {
        success: true,
        pdfGenerated: true,
        dataSaved: saveResult.success,
        message: saveResult.message,
        pendingData: pendingData,
        selectedPieces: selectedTotalPieces,
        totalPieces: matrix.totals.grand,
        totalZipCost: totalZipCost
    };
};
export function PuneetZipForm({ prefilledLotNo = '', setPrefilledLotNo = () => { } } = {}) {
    const [lotInput, setLotInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [matrix, setMatrix] = useState(null);
    const [error, setError] = useState('');
    const abortRef = useRef(null);
    // Add this with other state declarations
    const [priority, setPriority] = useState('Normal');
    // const [blockedShades, setBlockedShades] = useState(new Set());

    const [showIssueDialog, setShowIssueDialog] = useState(false);
    const [issueDate, setIssueDate] = useState(() => todayLocalISO());
    const [supervisor, setSupervisor] = useState('');
    const [dialogError, setDialogError] = useState('');
    const [confirming, setConfirming] = useState(false);

    // State for zip selections
    const [zipSelections, setZipSelections] = useState({});

    // State for zip quality data and selections
    const [zipQualityData, setZipQualityData] = useState([]);
    const [selectedZipTypes, setSelectedZipTypes] = useState([]);
    const [loadingZipQuality, setLoadingZipQuality] = useState(false);
    const [zipDataError, setZipDataError] = useState('');

    // State for garment-zip configuration and placements
    const [garmentZipConfig, setGarmentZipConfig] = useState({});
    const [selectedPlacements, setSelectedPlacements] = useState([]);
    // Keep these states but initialize them differently
    const [placementQuantities, setPlacementQuantities] = useState({});
    const [placementZipTypes, setPlacementZipTypes] = useState({});
    const [loadingGarmentConfig, setLoadingGarmentConfig] = useState(false);
    const [blockedShades, setBlockedShades] = useState(new Set());
    const [availableLots, setAvailableLots] = useState([]);

    useEffect(() => {
        const fetchAvailableLots = async () => {
            try {
                const res = await fetch(`${getBackendUrl()}/api/designs`);
                if (res.ok) {
                    const data = await res.json();
                    setAvailableLots(data.filter(d => d.status === 'Approved').slice(0, 6));
                }
            } catch (err) {
                console.warn('Failed to fetch designs:', err);
            }
        };
        fetchAvailableLots();
    }, []);


    // ---- Supervisor suggestions (with persistence) ----
    const LS_KEY_SUPERVISORS = 'issueStitching.supervisors';
    const DEFAULT_SUPERVISORS = ['SONU', 'SANJAY', 'MONU', 'ROHIT', 'VINAY'];

    const [supervisorOptions, setSupervisorOptions] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(LS_KEY_SUPERVISORS) || '[]');
            return uniqCaseInsensitive([...DEFAULT_SUPERVISORS, ...saved]);
        } catch {
            return DEFAULT_SUPERVISORS.slice();
        }
    });

    // Preload all required data on component mount
    useEffect(() => {
        const preloadData = async () => {
            setLoadingZipQuality(true);
            setLoadingGarmentConfig(true);

            try {
                const { garmentConfig, zipData } = await fetchAllRequiredData();
                setGarmentZipConfig(garmentConfig);
                setZipQualityData(zipData);

                if (zipData.length === 0) {
                    setZipDataError('No zip data found in the sheet.');
                }
            } catch (err) {
                console.error('Failed to preload data:', err);
                setZipDataError(`Failed to load data: ${err.message}`);
            } finally {
                setLoadingZipQuality(false);
                setLoadingGarmentConfig(false);
            }
        };

        preloadData();
    }, []);

    // Auto-search when redirected with a pre-filled lot number
    useEffect(() => {
        if (prefilledLotNo) {
            setLotInput(prefilledLotNo);
            // Small delay to ensure component and data are ready
            const timer = setTimeout(() => {
                handleSearch({ preventDefault: () => { } }, prefilledLotNo);
                setPrefilledLotNo('');
            }, 300);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefilledLotNo]);

    function saveSupervisorOptions(next) {
        const onlyCustom = next.filter(
            s => !DEFAULT_SUPERVISORS.map(x => x.toLowerCase()).includes((s || '').toLowerCase())
        );
        localStorage.setItem(LS_KEY_SUPERVISORS, JSON.stringify(onlyCustom));
    }

    function addSupervisorToOptions(name) {
        const t = titleCase(name);
        if (!t) return;
        const next = uniqCaseInsensitive([...supervisorOptions, t]);
        setSupervisorOptions(next);
        saveSupervisorOptions(next);
    }

    const typedIsNewSupervisor = useMemo(() => {
        const t = (supervisor ?? '').trim().toLowerCase();
        if (!t) return false;
        return !supervisorOptions.some(opt => (opt || '').toLowerCase() === t);
    }, [supervisor, supervisorOptions]);

    // Optimized search handler
    const handleSearch = async (e, lotOverride = null) => {
        e?.preventDefault?.();
        const normalizedLot = lotOverride ? norm(lotOverride) : norm(lotInput);
        if (!normalizedLot || loading) return;

        setError('');
        setMatrix(null);
        setBlockedShades(new Set()); // Reset blocked shades
        setLoading(true);

        abortRef.current?.abort?.();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        try {
            // Verify design approval status
            const designRes = await fetch(`${getBackendUrl()}/api/designs`, { signal: ctrl.signal });
            if (!designRes.ok) throw new Error('Failed to verify design status.');
            const designsList = await designRes.json();
            const matchingDesign = designsList.find(d => 
                String(d.id).toLowerCase() === normalizedLot.toLowerCase() ||
                String(d.name).toLowerCase() === normalizedLot.toLowerCase() ||
                (d.lotNo2 && String(d.lotNo2).toLowerCase() === normalizedLot.toLowerCase())
            );

            if (!matchingDesign) {
                // Check if cutting matrix header data exists for this lot
                const cuttingRes = await fetch(`${getBackendUrl()}/api/cutting/${normalizedLot}`, { signal: ctrl.signal });
                let hasCutting = false;
                if (cuttingRes.ok) {
                    const cData = await cuttingRes.json();
                    if (cData && (cData.header || (cData.rows && cData.rows.length > 0))) {
                        hasCutting = true;
                    }
                }
                if (!hasCutting) {
                    throw new Error(`Design lot #${normalizedLot} has not been created in the system yet.`);
                }
            } else if (matchingDesign.status !== 'Approved') {
                throw new Error(`Design lot #${normalizedLot} is currently "${matchingDesign.status}". It must be approved before compiling a Zip PO.`);
            }

            // Check cache first
            const cacheKey = `lot_${normalizedLot}`;
            const cachedMatrix = getCached(cacheKey);

            if (cachedMatrix) {
                console.log('Using cached lot data');
                setMatrix(cachedMatrix);
                await initializeZipSelections(cachedMatrix, ctrl.signal);
            } else {
                const data = await fetchLotMatrixViaSheetsApi(normalizedLot, ctrl.signal);
                setCached(cacheKey, data);
                setMatrix(data);
                await initializeZipSelections(data, ctrl.signal);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError(err?.message || "Failed to fetch data.");
            }
        } finally {
            setLoading(false);
        }
    };
    const initializeZipSelections = async (matrixData, _signal) => {
        let payload = null;
        if (matrixData.zipPayload) {
            try {
                payload = typeof matrixData.zipPayload === 'string'
                    ? JSON.parse(matrixData.zipPayload)
                    : matrixData.zipPayload;
            } catch (e) {
                console.warn('Failed to parse zipPayload:', e);
            }
        }

        const initialSelections = {};
        matrixData.rows.forEach(row => {
            if (payload && payload.zipSelections && payload.zipSelections[row.color] !== undefined) {
                initialSelections[row.color] = payload.zipSelections[row.color];
            } else {
                initialSelections[row.color] = '';
            }
        });

        setZipSelections(initialSelections);
        setBlockedShades(new Set()); // No shades are ever blocked

        if (payload) {
            if (payload.supervisor) setSupervisor(payload.supervisor);
            if (payload.priority) setPriority(payload.priority);
            if (payload.issueDate) setIssueDate(payload.issueDate);
            if (payload.selectedPlacements) setSelectedPlacements(payload.selectedPlacements);
            if (payload.placementQuantities) setPlacementQuantities(payload.placementQuantities);
            if (payload.placementZipTypes) setPlacementZipTypes(payload.placementZipTypes);
        } else {
            // Initialize with default values
            setPlacementQuantities({ default: 1 });
            setPlacementZipTypes({ default: availableZipTypes[0] || '' });
        }
    };

    const handleClear = () => {
        setLotInput('');
        setMatrix(null);
        setError('');
        setZipSelections({});
        setSelectedPlacements([]);
        setPlacementQuantities({});
        setPlacementZipTypes({});
        abortRef.current?.abort?.();
    };

    const handleBack = () => {
        if (window.history?.length > 1) window.history.back();
        else window.close?.();
    };

    const handleZipChange = (color, value) => {
        // Check if this shade is blocked
        if (blockedShades.has(color)) {
            alert(`This shade (${color}) already has a purchase order and cannot be modified.`);
            return;
        }

        setZipSelections(prev => ({
            ...prev,
            [color]: value
        }));
    };
    // Memoized calculations
    const availableZipTypes = useMemo(() => {
        const types = [...new Set(zipQualityData.map(item => item.type))];
        return types.sort();
    }, [zipQualityData]);

    const zipPlacementOptions = useMemo(() => {
        if (!matrix || !matrix.garmentType) return [];
        const normalizedType = norm(matrix.garmentType).toLowerCase();

        // Direct match first
        if (garmentZipConfig[normalizedType]) {
            return garmentZipConfig[normalizedType];
        }

        // Substring match: check if any config key is contained in matrix.garmentType
        const matchedKey = Object.keys(garmentZipConfig).find(key =>
            normalizedType.includes(key) || key.includes(normalizedType)
        );

        if (matchedKey) {
            return garmentZipConfig[matchedKey];
        }

        return [];
    }, [matrix, garmentZipConfig]);

    // Optimized zip price lookup
    const getZipPrice = (zipType, color) => {
        if (!zipType || !color || !zipQualityData) return 0;

        const item = zipQualityData.find(
            item => norm(item.type) === norm(zipType) &&
                norm(item.color).toLowerCase() === norm(color).toLowerCase()
        );
        return item ? item.price : 0;
    };

    const totalCost = useMemo(() => {
        if (!matrix || selectedPlacements.length === 0) return 0;

        let total = 0;

        selectedPlacements.forEach(placement => {
            const quantity = placementQuantities[placement] || 1;
            const zipType = placementZipTypes[placement];

            if (zipType) {
                matrix.rows.forEach(row => {
                    const color = row.color;
                    const zipColor = zipSelections[color];
                    if (zipColor && zipColor.trim() !== '' && !blockedShades.has(color)) {
                        const price = getZipPrice(zipType, zipColor);
                        const pieces = row.totalPcs || 0;
                        total += (price * pieces) * quantity;
                    }
                });
            }
        });

        return total;
    }, [placementQuantities, placementZipTypes, selectedPlacements, matrix, zipSelections, blockedShades]);

    // Toggle zip placement selection
    const togglePlacement = (placement) => {
        setSelectedPlacements(prev => {
            const newPlacements = prev.includes(placement)
                ? prev.filter(p => p !== placement)
                : [...prev, placement];

            // Reset quantities and zip types when placements change
            if (!newPlacements.includes(placement)) {
                setPlacementQuantities(prev => {
                    const newQuantities = { ...prev };
                    delete newQuantities[placement];
                    return newQuantities;
                });
                setPlacementZipTypes(prev => {
                    const newZipTypes = { ...prev };
                    delete newZipTypes[placement];
                    return newZipTypes;
                });
            } else {
                // Initialize with default values when adding a placement
                setPlacementQuantities(prev => ({
                    ...prev,
                    [placement]: 1
                }));
                setPlacementZipTypes(prev => ({
                    ...prev,
                    [placement]: availableZipTypes[0] || ''
                }));
            }

            return newPlacements;
        });
    };

    // Handle quantity change for a placement
    const handleQuantityChange = (placement, quantity) => {
        setPlacementQuantities(prev => ({
            ...prev,
            [placement]: Math.max(1, parseInt(quantity) || 1)
        }));
    };

    // Handle zip type change for a placement
    const handlePlacementZipTypeChange = (placement, zipType) => {
        setPlacementZipTypes(prev => ({
            ...prev,
            [placement]: zipType
        }));
    };

    const openIssueDialog = () => {
        setDialogError('');
        setSupervisor('');
        setIssueDate(todayLocalISO());
        setShowIssueDialog(true);
    };
    const closeIssueDialog = () => {
        if (confirming) return;
        setShowIssueDialog(false);
    };

    // ============================
    // UPDATED PDF GENERATION WITH SUPPLIER QR
    // ============================
    // ============================
    // Pending Zip Count Functions
    // ============================
    // async function fetchPendingZipCount(signal) {
    //   try {
    //     // Use your existing SHEET_IDD or create a new one for pending zips
    //     const range = encodeURIComponent('Sheet1!A1:Z'); // Adjust sheet name as needed
    //     const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_IDD}/values/${range}?key=${GOOGLE_API_KEY}`;

    //     const response = await fetch(url, { signal });
    //     if (!response.ok) {
    //       throw new Error(`Failed to fetch pending zip data: ${response.status}`);
    //     }

    //     const data = await response.json();
    //     if (!data?.values?.length) {
    //       return 0; // No data means no pending zips
    //     }

    //     const headers = data.values[0].map(norm);

    //     // Find column indices for the fields we need
    //     const materialEntryDateIndex = headers.findIndex(h => 
    //       includes(h, 'material entry date') || includes(h, 'material entry')
    //     );
    //     const lotNumberIndex = headers.findIndex(h => 
    //       includes(h, 'lot number') || includes(h, 'lot')
    //     );

    //     // If we can't find the required columns, return 0
    //     if (materialEntryDateIndex === -1 || lotNumberIndex === -1) {
    //       console.warn('Required columns not found for pending zip count');
    //       return 0;
    //     }

    //     // Count lots where Material Entry Date is empty
    //     let pendingCount = 0;
    //     for (let i = 1; i < data.values.length; i++) {
    //       const row = data.values[i] || [];
    //       const materialEntryDate = norm(row[materialEntryDateIndex]);
    //       const lotNumber = norm(row[lotNumberIndex]);

    //       // Count if lot number exists and material entry date is empty
    //       if (lotNumber && !materialEntryDate) {
    //         pendingCount++;
    //       }
    //     }

    //     return pendingCount;
    //   } catch (error) {
    //     console.error('Error fetching pending zip count:', error);
    //     return 0; // Return 0 on error to avoid breaking the PDF generation
    //   }
    // }

    // ============================
    // UPDATED PDF GENERATION WITH PENDING ZIP COUNT
    // ============================
    // ============================
    // UPDATED PDF GENERATION WITH PENDING ZIP COUNT DISPLAY

    const handleConfirmIssue = async () => {
        if (!norm(supervisor)) {
            setDialogError('Supervisor is required.');
            return;
        }
        if (!matrix) {
            setDialogError('Nothing to submit. Search a lot first.');
            return;
        }

        setDialogError('');
        setConfirming(true);

        try {
            addSupervisorToOptions(supervisor);

            // Fetch unique ZIP PO number from backend
            let poNumber = '';
            try {
                const poRes = await fetch(`${getBackendUrl()}/api/po-number/next/zip`);
                const poData = await poRes.json();
                poNumber = poData.poNumber || '';
            } catch (e) {
                console.warn('Could not fetch PO number:', e);
            }

            // Generate PDF with selected shades data
            const result = await generateIssuePdf(matrix, {
                issueDate,
                supervisor,
                priority,
                zipSelections,
                selectedPlacements,
                placementQuantities,
                placementZipTypes,
                zipQualityData,
                blockedShades,
                poNumber
            });

            setShowIssueDialog(false);

            if (result.success) {
                // Save to local database payload column
                try {
                    const zipPayload = {
                        issueDate,
                        supervisor,
                        priority,
                        zipSelections,
                        selectedPlacements,
                        placementQuantities,
                        placementZipTypes,
                        zipQualityData,
                        totalCost: result.totalZipCost || 0,
                        poNumber,
                    };
                    await fetch(`${getBackendUrl()}/api/cutting-headers/${matrix.lotNumber}/payload`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ zip_payload: JSON.stringify(zipPayload), po_number: poNumber })
                    });
                } catch (saveErr) {
                    console.error("Failed to save zip payload local:", saveErr);
                }

                // Calculate selected pieces for the success message (excluding blocked shades)
                const selectedCount = Object.entries(zipSelections)
                    .filter(([color, selection]) =>
                        selection && selection.trim() !== '' && !blockedShades.has(color)
                    ).length;

                const selectedPieces = matrix.rows
                    .filter(row =>
                        zipSelections[row.color] &&
                        zipSelections[row.color].trim() !== '' &&
                        !blockedShades.has(row.color)
                    )
                    .reduce((sum, row) => sum + (row.totalPcs || 0), 0);

                alert(`PDF generated successfully! Stored ${selectedPieces} pieces (${selectedCount} selected shades) instead of complete lot. ${blockedShades.size > 0 ? `${blockedShades.size} shades were blocked due to existing orders.` : ''}`);
            } else {
                alert('PDF generated but data saving failed: ' + result.message);
            }

        } catch (e) {
            setDialogError(e?.message || 'Failed to generate PDF.');
        } finally {
            setConfirming(false);
        }
    };

    const displaySizes = useMemo(() => {
        if (!matrix) return [];
        return matrix.sizes || [];
    }, [matrix]);

    const columns = useMemo(
        () => (matrix ? ['Color', 'Cutting Table', ...displaySizes, 'Total Pcs', 'ZIP COLOR'] : []),
        [matrix, displaySizes]
    );

    return (
        <div className="Wrap">
            <style>
                {`
        /* Add loading state styles */
        .Skeleton {
          background: linear-gradient(90deg, #ffffffff 25%, #ffffffff 50%, #ffffffff 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: 4px;
        }

        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .SkeletonText {
          height: 1rem;
          margin-bottom: 0.5rem;
        }

        .SkeletonButton {
          height: 3rem;
          border-radius: 14px;
        }

        /* Keep all your existing styles from the original component */
        .Wrap {
          max-width: 100%;
          margin: 0;
          padding: 12px 16px 41px;
          box-sizing: border-box;
          font-family: 'Inter', system-ui, sans-serif;
          color: var(--text-main, #0f172a);
          min-height: 100vh;
          background: var(--bg-primary, #ffffff);
        }

        .HeaderPaper {
          background: var(--bg-secondary, #ffffff);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 28px 32px;
          margin-bottom: 24px;
          box-shadow: 0 2px 20px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          align-items: center;
          border: 1px solid var(--accent-light, rgba(99, 102, 241, 0.12));
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .HeaderPaper::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--accent-color, #6366f1), var(--accent-hover, #4f46e5), var(--accent-color, #6366f1));
          background-size: 200% 100%;
          animation: shimmerGrad 4s ease infinite;
        }

        @keyframes shimmerGrad {
          0% { background-position: 0% 0%; }
          50% { background-position: 100% 0%; }
          100% { background-position: 0% 0%; }
        }

        @media (max-width: 900px) {
          .HeaderPaper {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }

        .TitleSection {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .TitleSection h1 {
          margin: 0 0 6px 0;
          font-size: 1.75rem;
          font-weight: 900;
          font-family: var(--font-family-title);
          background: linear-gradient(135deg, var(--accent-hover, #4f46e5) 0%, var(--accent-color, #6366f1) 40%, var(--accent-hover, #4f46e5) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.5px;
        }

        .TitleSection p {
          margin: 0;
          color: var(--text-muted, #64748b);
          font-size: 0.95rem;
          font-weight: 400;
        }

        .TitleIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 68px;
          height: 68px;
          border-radius: 18px;
          background: linear-gradient(135deg, var(--accent-hover, #4f46e5) 0%, var(--accent-color, #6366f1) 50%, var(--accent-hover, #4f46e5) 100%);
          color: white;
          font-size: 26px;
          box-shadow: 0 8px 24px var(--accent-light, rgba(99, 102, 241, 0.35)), 0 2px 6px var(--accent-light, rgba(99, 102, 241, 0.2));
          flex-shrink: 0;
        }

        .SearchSection {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .Form {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: center;
        }

        @media (max-width: 560px) {
          .Form {
            grid-template-columns: 1fr;
          }
        }

        .SearchBox {
          display: grid;
          grid-template-columns: 20px 1fr;
          align-items: center;
          gap: 12px;
          padding: 12px 18px;
          border-radius: 12px;
          background: var(--bg-secondary, #ffffff);
          border: 1.5px solid var(--border-color, #e2e8f0);
          box-shadow: var(--shadow-sm);
          color: var(--text-muted);
          transition: all 0.25s ease;
        }

        .SearchBox:focus-within {
          border-color: var(--accent-color, #6366f1);
          box-shadow: 0 0 0 3.5px var(--accent-light, rgba(99, 102, 241, 0.15));
          color: var(--accent-color);
        }

        .SearchBox input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-main, #0f172a);
          font-size: 1rem;
          font-weight: 500;
          width: 100%;
        }

        .SearchBox input::placeholder {
          color: var(--text-light, #94a3b8);
          font-weight: 400;
        }

        .BtnRow {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .BaseBtn {
          border-radius: 10px;
          padding: 12px 20px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          border: none;
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 0.9rem;
          font-family: inherit;
          letter-spacing: 0.2px;
          white-space: nowrap;
        }

        .PrimaryBtn {
          background: linear-gradient(135deg, var(--accent-hover, #4f46e5), var(--accent-color, #6366f1));
          color: white;
          box-shadow: 0 4px 12px var(--accent-light, rgba(99, 102, 241, 0.3));
        }

        .PrimaryBtn:hover:not(:disabled) {
          background: linear-gradient(135deg, var(--accent-color, #6366f1), var(--accent-hover, #4f46e5));
          transform: translateY(-2px);
          box-shadow: 0 8px 20px var(--accent-light, rgba(99, 102, 241, 0.4));
        }

        .PrimaryBtn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none;
        }

        .GhostBtn {
          background: var(--bg-secondary, #ffffff);
          border: 1.5px solid var(--border-color, #e2e8f0);
          color: var(--text-muted, #64748b);
        }

        .GhostBtn:hover {
          background: var(--bg-primary, #f8fafc);
          border-color: var(--accent-color, #6366f1);
          color: var(--accent-color, #6366f1);
          transform: translateY(-1px);
          box-shadow: 0 3px 10px var(--accent-light, rgba(99, 102, 241, 0.12));
        }

        .Spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.6);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .ErrorCard {
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: 20px 1fr;
          gap: 12px;
          align-items: center;
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.15);
          color: #dc2626;
          padding: 16px 20px;
          border-radius: 12px;
          font-weight: 500;
          font-size: 0.95rem;
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.04);
        }

        .HintCard {
          margin-top: 24px;
          padding: 20px;
          border-radius: 14px;
          background: var(--bg-secondary, #ffffff);
          border: 2px dashed var(--border-color, #e2e8f0);
          color: var(--text-muted, #64748b);
          font-size: 0.95rem;
          line-height: 1.5;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }

        .HintCard code {
          background: var(--bg-primary, #f1f5f9);
          padding: 4px 8px;
          border-radius: 6px;
          font-family: monospace;
          color: var(--text-main, #0f172a);
          font-size: 0.88rem;
          font-weight: 600;
        }

        .ContentGrid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 28px;
        }

        @media (max-width: 1100px) {
          .ContentGrid {
            grid-template-columns: 1fr;
          }
        }

        .InfoPanel {
          background: var(--bg-secondary, #ffffff);
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          border: 1px solid var(--border-color, #e2e8f0);
          display: flex;
          flex-direction: column;
          height: fit-content;
        }

        .TablePanel {
          background: var(--bg-secondary, #ffffff);
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          border: 1px solid var(--border-color, #e2e8f0);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .blocked-row {
          background-color: rgba(239, 68, 68, 0.05) !important;
          opacity: 0.7;
        }

        .blocked-row:hover {
          background-color: rgba(239, 68, 68, 0.05) !important;
        }

        .blocked-row td {
          color: var(--text-light, #94a3b8) !important;
        }

        .ZipQualityPanel {
          background: var(--bg-secondary, #ffffff);
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          border: 1px solid var(--border-color, #e2e8f0);
          margin-top: 24px;
        }

        .PanelHeader {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 2px solid var(--border-color, #e2e8f0);
        }

        .PanelHeader h3 {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--text-main, #0f172a);
          font-family: var(--font-family-title);
        }

        .PanelHeader svg {
          color: var(--accent-color, #6366f1);
          font-size: 1.2rem;
        }

        .InfoGrid {
          display: grid;
          gap: 16px;
          margin-bottom: 28px;
        }

        .InfoItem {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 16px;
          align-items: center;
          padding: 16px;
          background: var(--bg-primary, #f8fafc);
          border-radius: 14px;
          border: 1px solid var(--border-color, #e2e8f0);
          transition: all 0.2s ease;
        }

        .InfoItem:hover {
          background: var(--bg-secondary, #ffffff);
          border-color: var(--accent-color, #6366f1);
          transform: translateY(-1px);
        }

        .InfoIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--accent-hover, #4f46e5), var(--accent-color, #6366f1));
          color: white;
          font-size: 1.1rem;
          box-shadow: 0 4px 10px var(--accent-light, rgba(99, 102, 241, 0.25));
          flex-shrink: 0;
        }

        .InfoLabel {
          font-size: 0.9rem;
          color: var(--text-muted, #64748b);
          font-weight: 500;
          margin-bottom: 4px;
        }

        .InfoValue {
          font-weight: 600;
          color: var(--text-main, #0f172a);
          font-size: 1.05rem;
        }

        .SummaryCard {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          margin-bottom: 28px;
          background: var(--border-color, #e2e8f0);
          border-radius: 14px;
          border: 1px solid var(--border-color, #e2e8f0);
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .SummaryItem {
          text-align: center;
          padding: 18px 12px;
          background: var(--bg-primary, #f8fafc);
        }

        .SummaryLabel {
          font-size: 0.8rem;
          color: var(--text-muted, #64748b);
          margin-bottom: 8px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .SummaryValue {
          font-weight: 900;
          background: linear-gradient(135deg, var(--accent-hover, #4f46e5), var(--accent-color, #6366f1));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-size: 1.6rem;
        }

        .ActionsRow {
          display: flex;
          justify-content: flex-end;
          margin-top: auto;
          gap: 16px;
          flex-wrap: wrap;
        }

        .TableContainer {
          width: 100%;
          overflow: auto;
          border-radius: 12px;
          border: 1px solid var(--border-color, #e2e8f0);
        }

        .Table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 0.92rem;
        }

        .Table thead th {
          position: sticky;
          top: 0;
          background: linear-gradient(135deg, var(--accent-hover, #4f46e5) 0%, var(--accent-color, #6366f1) 60%, var(--accent-hover, #4f46e5) 100%);
          text-align: center;
          padding: 14px 18px;
          border-bottom: 2px solid rgba(255,255,255,0.1);
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          letter-spacing: 0.3px;
          font-size: 0.88rem;
          text-transform: uppercase;
        }

        .Table tbody td, .Table tfoot td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          color: var(--text-main, #0f172a);
        }

        .Table tbody tr {
          transition: background 0.2s ease;
          background: var(--bg-secondary, #ffffff);
        }

        .Table tbody tr:hover {
          background: var(--bg-primary, #f8fafc);
        }

        .Table td.num {
          text-align: center;
          font-variant-numeric: tabular-nums;
          font-weight: 500;
        }

        .Table td.strong, .Table th.strong {
          font-weight: 700;
        }

        .Table tfoot td {
          background: linear-gradient(135deg, var(--accent-light, rgba(99, 102, 241, 0.06)), var(--accent-light, rgba(99, 102, 241, 0.06)));
          font-weight: 800;
          color: var(--text-main, #0f172a);
          font-size: 0.95rem;
          border-top: 2px solid var(--accent-color, #6366f1);
        }

        .ZipSelect {
          padding: 8px 12px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          background: var(--bg-secondary, #ffffff);
          color: var(--text-main, #0f172a);
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 120px;
        }

        .ZipSelect:focus {
          outline: none;
          border-color: var(--accent-color, #6366f1);
          box-shadow: 0 0 0 3px var(--accent-light, rgba(99, 102, 241, 0.15));
        }

        .ZipSelect:hover {
          border-color: var(--accent-hover, #4f46e5);
        }

        .ZipQualityForm {
          display: grid;
          gap: 24px;
          margin-bottom: 24px;
        }

        .PlacementSection {
          padding: 24px;
          background: var(--bg-secondary, #ffffff);
          border-radius: 16px;
          border: 1px solid var(--border-color, #e2e8f0);
          box-shadow: 0 4px 16px rgba(0,0,0,0.02);
        }

        .PlacementSection h4 {
          margin: 0 0 20px 0;
          color: var(--text-main, #0f172a);
          font-size: 1.15rem;
          font-weight: 800;
          font-family: var(--font-family-title);
          letter-spacing: -0.3px;
        }

        .CheckboxGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 14px;
          margin-bottom: 24px;
        }

        .CheckboxItem {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: var(--bg-primary, #f8fafc);
          border: 1.5px solid var(--border-color, #e2e8f0);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .CheckboxItem:hover {
          border-color: var(--accent-hover, #4f46e5);
          background: var(--bg-secondary, #ffffff);
          transform: translateY(-1.5px);
          box-shadow: 0 4px 12px var(--accent-light, rgba(99, 102, 241, 0.08));
        }

        .CheckboxItem.selected {
          border-color: var(--accent-color, #6366f1);
          background: var(--accent-light, rgba(99, 102, 241, 0.06));
          box-shadow: 0 0 0 3px var(--accent-light, rgba(99, 102, 241, 0.1));
        }

        .CheckboxIcon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border: 2px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          transition: all 0.2s ease;
          background: var(--bg-secondary, #ffffff);
          color: transparent;
          flex-shrink: 0;
        }

        .CheckboxItem.selected .CheckboxIcon {
          background: linear-gradient(135deg, var(--accent-hover, #4f46e5), var(--accent-color, #6366f1));
          border-color: var(--accent-color, #6366f1);
          color: white;
        }

        .CheckboxLabel {
          font-weight: 600;
          color: var(--text-main, #0f172a);
          font-size: 0.9rem;
        }

        .CostBreakdown {
          margin-top: 24px;
          padding: 20px 24px;
          background: var(--accent-light, rgba(99, 102, 241, 0.03));
          border-radius: 14px;
          border: 1.5px solid var(--accent-color, #6366f1);
        }

        .CostBreakdown h4 {
          margin: 0 0 14px 0;
          color: var(--accent-color, #6366f1);
          font-size: 1rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .CostItem {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid rgba(99, 102, 241, 0.06);
        }

        .CostItem:last-child {
          border-bottom: none;
        }

        .CostLabel {
          color: var(--text-muted, #64748b);
          font-weight: 500;
          font-size: 0.9rem;
        }

        .CostValue {
          color: var(--text-main, #0f172a);
          font-weight: 600;
          font-size: 0.95rem;
        }

        .TotalCost {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 2px dashed var(--accent-color, #6366f1);
          display: flex;
          justify-content: space-between;
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--accent-color, #6366f1);
        }

        .Dialog {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--bg-secondary, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.05);
          border-radius: 20px;
          padding: 32px;
          z-index: 1001;
          max-width: 600px;
          width: 90%;
          overflow: hidden;
        }

        .DialogHeader {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 20px;
          margin-bottom: 28px;
        }

        .DialogHeader h3 {
          margin: 0;
          font-size: 1.45rem;
          font-weight: 900;
          color: var(--text-main, #0f172a);
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: var(--font-family-title);
          letter-spacing: -0.3px;
        }

        .IconBtn {
          display: inline-grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid var(--border-color, #e2e8f0);
          color: var(--text-muted, #64748b);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .IconBtn:hover {
          background: var(--bg-primary, #f8fafc);
          border-color: var(--accent-color, #6366f1);
          color: var(--accent-color, #6366f1);
          transform: scale(1.05);
        }

        .Field {
          display: grid;
          gap: 10px;
          margin: 24px 0 20px;
        }

        .Field input {
          width: 100%;
          padding: 14px 18px;
          border-radius: 12px;
          border: 1.5px solid var(--border-color, #e2e8f0);
          background: var(--bg-primary, #f8fafc);
          color: var(--text-main, #0f172a);
          outline: none;
          transition: all 0.22s ease;
          font-size: 0.95rem;
          font-weight: 500;
        }

        .Field input:focus {
          border-color: var(--accent-color, #6366f1);
          box-shadow: 0 0 0 3px var(--accent-light, rgba(99, 102, 241, 0.15));
          background: var(--bg-secondary, #ffffff);
        }

        .FieldLabel {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-size: 1.1rem;
          color: var(--text-muted, #64748b);
          font-weight: 600;
        }

        .InlineError {
          margin-top: 20px;
          display: grid;
          grid-template-columns: 24px 1fr;
          gap: 12px;
          align-items: center;
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.15);
          color: #dc2626;
          padding: 16px 20px;
          border-radius: 14px;
          font-size: 1rem;
          font-weight: 500;
        }

        .DialogActions {
          margin-top: 32px;
          display: flex;
          justify-content: flex-end;
          gap: 20px;
        }

        .Backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 1000;
        }

        .ConfigStatus {
          font-size: 0.8rem;
          color: var(--text-muted, #64748b);
          margin-left: auto;
          background: var(--bg-primary, #f1f5f9);
          padding: 4px 8px;
          border-radius: 6px;
        }

        .ConfigStatus.loading {
          color: var(--accent-color, #6366f1);
          background: var(--accent-light, rgba(99, 102, 241, 0.1));
        }

        .ConfigStatus.loaded {
          color: #059669;
          background: rgba(5, 150, 105, 0.1);
        }

        .ConfigStatus.error {
          color: #dc2626;
          background: rgba(220, 38, 38, 0.1);
        }

        .PlacementItem {
          background: var(--bg-secondary, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-left: 4px solid var(--accent-color, #6366f1);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .PlacementItem:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px var(--accent-light, rgba(99, 102, 241, 0.08));
          border-left-color: var(--accent-hover, #4f46e5);
        }

        .PlacementHeader {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .PlacementContent {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 20px;
          align-items: start;
        }

        .QuantityInput {
          padding: 12px 16px;
          border: 1.5px solid var(--border-color, #e2e8f0);
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 500;
          width: 100%;
          background: var(--bg-primary, #f8fafc);
          color: var(--text-main, #0f172a);
          outline: none;
          transition: all 0.22s ease;
        }

        .QuantityInput:focus {
          border-color: var(--accent-color, #6366f1);
          box-shadow: 0 0 0 3px var(--accent-light, rgba(99, 102, 241, 0.15));
          background: var(--bg-secondary, #ffffff);
        }

        .ZipTypeSelect {
          padding: 12px 16px;
          border: 1.5px solid var(--border-color, #e2e8f0);
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 500;
          width: 100%;
          background: var(--bg-primary, #f8fafc);
          color: var(--text-main, #0f172a);
          outline: none;
          transition: all 0.22s ease;
          cursor: pointer;
        }

        .ZipTypeSelect:focus {
          border-color: var(--accent-color, #6366f1);
          box-shadow: 0 0 0 3px var(--accent-light, rgba(99, 102, 241, 0.15));
          background: var(--bg-secondary, #ffffff);
        }

        .FormField {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .FormField label {
          font-size: 0.75rem;
          color: var(--accent-color, #6366f1);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        `}
            </style>

            {/* If NO lot is searched, show a beautiful Centered Search Portal */}
            {!matrix && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '80px 20px',
                    maxWidth: '620px',
                    margin: '0 auto',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '24px',
                        background: 'var(--accent-light, rgba(99, 102, 241, 0.12))',
                        color: 'var(--accent-color, #6366f1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '36px',
                        marginBottom: '24px',
                        boxShadow: 'var(--shadow-md)'
                    }}>
                        <FiPackage />
                    </div>
                    <h1 style={{
                        fontSize: '2.2rem',
                        fontWeight: '900',
                        fontFamily: 'var(--font-family-title)',
                        color: 'var(--text-main)',
                        margin: '0 0 10px 0',
                        letterSpacing: '-0.8px'
                    }}>
                        Zip Purcharge Orders Generator
                    </h1>
                    <p style={{
                        color: 'var(--text-muted)',
                        fontSize: '1rem',
                        marginBottom: '32px',
                        lineHeight: '1.6',
                        fontWeight: '400'
                    }}>
                        Query lot cutting sheets, check existing Zip purchase logs, block matching shades, and calculate materials and cost requirements to print standard PO documentations.
                    </p>

                    <form onSubmit={handleSearch} style={{
                        width: '100%',
                        display: 'flex',
                        gap: '12px',
                        marginBottom: '24px'
                    }}>
                        <div className="SearchBox" style={{ flex: 1 }}>
                            <FiSearch />
                            <input
                                value={lotInput}
                                onChange={(e) => setLotInput(e.target.value)}
                                placeholder="Enter Lot Number (e.g. 11202, 11028)"
                                autoFocus
                            />
                        </div>
                        <button
                            className="BaseBtn PrimaryBtn"
                            type="submit"
                            disabled={!norm(lotInput) || loading}
                            style={{ padding: '14px 28px' }}
                        >
                            {loading ? <div className="Spinner"></div> : 'Search'}
                        </button>
                    </form>

                    {/* Quick suggestion chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '4px', fontWeight: '500' }}>Recent Lots:</span>
                        {['11001', '11028', '11030', '11033', '11034'].map(lot => (
                            <button
                                key={lot}
                                type="button"
                                onClick={() => {
                                    setLotInput(lot);
                                    setTimeout(() => {
                                        handleSearch({ preventDefault: () => { } }, lot);
                                    }, 50);
                                }}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--accent-color)',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: 'var(--shadow-sm)'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent-color)';
                                    e.currentTarget.style.background = 'var(--accent-light)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                    e.currentTarget.style.background = 'var(--bg-secondary)';
                                }}
                            >
                                #{lot}
                            </button>
                        ))}
                    </div>

                    {/* Available Approved Lots Grid */}
                    {availableLots.length > 0 && (
                        <div style={{ marginTop: '36px', width: '100%', textAlign: 'left' }}>
                            <h3 style={{
                                fontSize: '0.85rem',
                                fontWeight: '750',
                                fontFamily: 'var(--font-family-title)',
                                color: 'var(--text-muted)',
                                marginBottom: '16px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <FiCheckSquare size={14} style={{ color: 'var(--success)' }} /> Approved Designs Ready for Zip Purcharge Orders
                            </h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                gap: '14px',
                                width: '100%'
                            }}>
                                {availableLots.map(lot => (
                                    <div
                                        key={lot.id}
                                        onClick={() => {
                                            setLotInput(lot.id);
                                            setTimeout(() => {
                                                handleSearch({ preventDefault: () => { } }, lot.id);
                                            }, 50);
                                        }}
                                        style={{
                                            background: 'var(--bg-secondary)',
                                            border: '1.5px solid var(--border-color)',
                                            borderRadius: '16px',
                                            padding: '16px',
                                            cursor: 'pointer',
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: 'var(--shadow-sm)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            minHeight: '94px'
                                        }}
                                        className="LotCard"
                                    >
                                        <div style={{
                                            fontSize: '10px',
                                            fontWeight: '800',
                                            color: 'var(--accent-color)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            marginBottom: '6px'
                                        }}>
                                            Lot #{lot.id}
                                        </div>
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: '800',
                                            color: 'var(--text-main)',
                                            marginBottom: '6px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {lot.name}
                                        </div>
                                        <div style={{
                                            fontSize: '12px',
                                            color: 'var(--text-muted)',
                                            marginTop: 'auto'
                                        }}>
                                            {lot.category} • {lot.brand}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* If lot matrix IS searched, show compact horizontal search header */}
            {matrix && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '20px',
                    padding: '16px 24px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '28px',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: 'var(--accent-light, rgba(99, 102, 241, 0.12))',
                            color: 'var(--accent-color, #6366f1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px'
                        }}>
                            <FiPackage />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
                                Lot #{matrix.lotNumber} PO Panel
                            </h2>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                                {matrix.style || 'No Style'} • {matrix.fabric || 'No Fabric'} • {matrix.garmentType || 'No Type'}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div className="SearchBox" style={{
                            width: '240px',
                            padding: '0 14px',
                            height: '40px',
                            margin: 0
                        }}>
                            <FiSearch />
                            <input
                                value={lotInput}
                                onChange={(e) => setLotInput(e.target.value)}
                                placeholder="Search another lot..."
                            />
                        </div>
                        <button
                            className="BaseBtn PrimaryBtn"
                            type="submit"
                            disabled={!norm(lotInput) || loading}
                            style={{ padding: '10px 18px', fontSize: '0.85rem' }}
                        >
                            {loading ? <div className="Spinner"></div> : 'Search'}
                        </button>
                        <button
                            className="BaseBtn GhostBtn"
                            type="button"
                            onClick={handleClear}
                            style={{ padding: '10px 18px', fontSize: '0.85rem' }}
                        >
                            Reset
                        </button>
                    </form>
                </div>
            )}

            <AnimatePresence>
                {error && (
                    <motion.div
                        className="ErrorCard"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                    >
                        <FiAlertTriangle />
                        <span>{error}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Loading state for initial data */}
            {loadingZipQuality && !matrix && (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="Spinner" style={{ margin: '0 auto', width: '32px', height: '32px' }}></div>
                    <p style={{ marginTop: '16px', color: '#64748b' }}>Loading application data...</p>
                </div>
            )}

            {matrix ? (
                <>
                    <div className="ContentGrid">
                        <div className="InfoPanel">
                            <div className="PanelHeader">
                                <FiInfo />
                                <h3>Lot Information</h3>
                                <span className={`ConfigStatus ${loadingGarmentConfig ? 'loading' : 'loaded'}`}>
                                    {loadingGarmentConfig ? 'Loading config...' : 'Config loaded'}
                                </span>
                            </div>
                            <div className="InfoGrid">
                                <div className="InfoItem">
                                    <div className="InfoIcon"><FiPackage /></div>
                                    <div><div className="InfoLabel">Lot Number</div><div className="InfoValue">{matrix.lotNumber || '—'}</div></div>
                                </div>
                                <div className="InfoItem">
                                    <div className="InfoIcon"><FiTag /></div>
                                    <div><div className="InfoLabel">Style</div><div className="InfoValue">{matrix.style || '—'}</div></div>
                                </div>
                                <div className="InfoItem">
                                    <div className="InfoIcon"><FiGrid /></div>
                                    <div><div className="InfoLabel">Fabric</div><div className="InfoValue">{matrix.fabric || '—'}</div></div>
                                </div>
                                <div className="InfoItem">
                                    <div className="InfoIcon"><FiTag /></div>
                                    <div>
                                        <div className="InfoLabel">Garment Type</div>
                                        <div className="InfoValue">{matrix.garmentType || '—'}</div>
                                    </div>
                                </div>
                                <div className="InfoItem">
                                    <div className="InfoIcon"><FiTag /></div>
                                    <div>
                                        <div className="InfoLabel">Brand</div>
                                        <div className="InfoValue">{matrix.brand || '—'}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="SummaryCard">
                                <div className="SummaryItem"><div className="SummaryLabel">Total Pieces</div><div className="SummaryValue">{matrix.totals.grand}</div></div>
                                <div className="SummaryItem"><div className="SummaryLabel">Colors</div><div className="SummaryValue">{matrix.rows.length}</div></div>
                                <div className="SummaryItem"><div className="SummaryLabel">Sizes</div><div className="SummaryValue">{matrix.sizes.length}</div></div>
                            </div>

                            <div className="ActionsRow">
                                <motion.button
                                    className="BaseBtn PrimaryBtn"
                                    type="button"
                                    onClick={openIssueDialog}
                                    whileTap={{ scale: 0.98 }}
                                    whileHover={{ scale: 1.02 }}
                                >
                                    <FiDownload /> Submit for PO
                                </motion.button>
                            </div>
                        </div>

                        <div className="TablePanel">
                            <div className="PanelHeader"><FiGrid /><h3>Cutting Matrix</h3></div>
                            <div className="TableContainer">
                                <table className="Table">
                                    <thead>
                                        <tr>{columns.map((c, i) => <th key={`${c || 'blank'}-${i}`}>{c || '\u00A0'}</th>)}</tr>
                                    </thead>
                                    <tbody>
                                        {matrix.rows.map((r, idx) => (
                                            <tr key={idx} className={blockedShades.has(r.color) ? 'blocked-row' : ''}>
                                                <td>
                                                    {r.color}
                                                    {blockedShades.has(r.color) && (
                                                        <span style={{ marginLeft: '8px', color: '#ef4444', fontSize: '0.8rem' }}>
                                                            <FiLock /> Ordered
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="num">{r.cuttingTable ?? ''}</td>
                                                {matrix.sizes.map((s) => (
                                                    <td key={s} className="num">{r.sizes?.[s] ?? ''}</td>
                                                ))}
                                                <td className="num strong">{r.totalPcs ?? ''}</td>
                                                <td>
                                                    {blockedShades.has(r.color) ? (
                                                        <div style={{
                                                            padding: '8px 12px',
                                                            backgroundColor: '#fef2f2',
                                                            border: '1px solid #fecaca',
                                                            borderRadius: '8px',
                                                            color: '#dc2626',
                                                            fontSize: '0.9rem',
                                                            textAlign: 'center'
                                                        }}>
                                                            <FiLock /> Already Ordered
                                                        </div>
                                                    ) : (
                                                        <select
                                                            className="ZipSelect"
                                                            value={zipSelections[r.color] || ''}
                                                            onChange={(e) => handleZipChange(r.color, e.target.value)}
                                                            disabled={blockedShades.has(r.color)}
                                                        >
                                                            <option value="">Select Color</option>
                                                            <option value="Coloured">Coloured</option>
                                                            <option value="Black">Black</option>
                                                        </select>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td className="strong">Total</td>
                                            <td className="num">—</td>
                                            {matrix.sizes.map((s) => (
                                                <td key={s} className="num strong">{matrix.totals.perSize?.[s] ?? 0}</td>
                                            ))}
                                            <td className="num strong">{matrix.totals.grand}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Zip Quality Section */}
                    <div className="ZipQualityPanel">
                        <div className="PanelHeader">
                            <FiPackage />
                            <h3>Zip Quality Requirements</h3>
                            {zipQualityData.length > 0 && (
                                <span style={{
                                    fontSize: '0.8rem',
                                    color: '#64748b',
                                    marginLeft: 'auto',
                                    background: '#f1f5f9',
                                    padding: '4px 8px',
                                    borderRadius: '6px'
                                }}>
                                    {zipQualityData.length} zip types loaded
                                </span>
                            )}
                        </div>

                        {loadingZipQuality ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                <div className="Spinner" style={{ margin: '0 auto' }}></div>
                                <p style={{ marginTop: '12px', color: '#64748b' }}>Loading zip quality data...</p>
                            </div>
                        ) : zipDataError ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '12px',
                                color: '#dc2626'
                            }}>
                                <FiAlertTriangle style={{ fontSize: '2rem', marginBottom: '12px' }} />
                                <p>{zipDataError}</p>
                                <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>
                                    Required columns: Zip Type, Color, Approx. Price (₹)
                                </p>
                            </div>
                        ) : zipQualityData.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '12px',
                                color: '#dc2626'
                            }}>
                                <FiAlertTriangle style={{ fontSize: '2rem', marginBottom: '12px' }} />
                                <p>No zip quality data found. Please check your Google Sheet.</p>
                                <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>
                                    Required columns: ZIP Type, Color, Approx. Price (₹)
                                </p>
                            </div>
                        ) : (
                            <div className="ZipQualityForm">
                                {/* Zip Placement Selection with Quantity and Zip Type */}
                                {zipPlacementOptions.length > 0 && (
                                    <div className="PlacementSection">
                                        <h4>Select the items where the zip are placed in this article:</h4>
                                        <div className="CheckboxGrid">
                                            {zipPlacementOptions.map((placement) => (
                                                <div
                                                    key={placement}
                                                    className={`CheckboxItem ${selectedPlacements.includes(placement) ? 'selected' : ''}`}
                                                    onClick={() => togglePlacement(placement)}
                                                >
                                                    <div className="CheckboxIcon">
                                                        {selectedPlacements.includes(placement) && <FiCheckSquare />}
                                                        {!selectedPlacements.includes(placement) && <FiSquare />}
                                                    </div>
                                                    <span className="CheckboxLabel">{placement}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Placement Configuration */}
                                        {selectedPlacements.length > 0 && (
                                            <div>
                                                <h4 style={{ margin: '20px 0 16px 0', color: '#475569', fontSize: '1rem' }}>
                                                    Configure each placement:
                                                </h4>
                                                {selectedPlacements.map((placement) => (
                                                    <div key={placement} className="PlacementItem">
                                                        <div className="PlacementHeader">
                                                            <FiTag style={{ color: '#8b5cf6' }} />
                                                            <span style={{ fontWeight: '600', color: '#1e293b' }}>{placement}</span>
                                                        </div>
                                                        <div className="PlacementContent">
                                                            <div className="FormField">
                                                                <label>Quantity per piece</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    className="QuantityInput"
                                                                    value={placementQuantities[placement] || 1}
                                                                    onChange={(e) => handleQuantityChange(placement, e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="FormField">
                                                                <label>Zip Quality Type</label>
                                                                <select
                                                                    className="ZipTypeSelect"
                                                                    value={placementZipTypes[placement] || ''}
                                                                    onChange={(e) => handlePlacementZipTypeChange(placement, e.target.value)}
                                                                >
                                                                    <option value="">Select Zip Type</option>
                                                                    {availableZipTypes.map((type) => (
                                                                        <option key={type} value={type}>{type}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Cost Breakdown */}
                                {selectedPlacements.length > 0 && (
                                    <div className="CostBreakdown">
                                        <h4>Cost Breakdown</h4>

                                        {selectedPlacements.map(placement => {
                                            const quantity = placementQuantities[placement] || 1;
                                            const zipType = placementZipTypes[placement];

                                            if (!zipType) {
                                                return (
                                                    <div key={placement} style={{ marginBottom: '16px', padding: '12px', background: '#fef3c7', borderRadius: '8px' }}>
                                                        <p style={{ fontWeight: 'bold', color: '#92400e', margin: 0 }}>
                                                            {placement}: Please select a zip type
                                                        </p>
                                                    </div>
                                                );
                                            }

                                            let placementSubtotal = 0;
                                            const costItems = [];

                                            // Calculate costs for this placement
                                            matrix.rows.forEach((row) => {
                                                const color = row.color;

                                                // Skip blocked shades and empty selections
                                                if (blockedShades.has(color)) return;

                                                const zipColor = zipSelections[color];
                                                if (zipColor && zipColor.trim() !== '') {
                                                    const price = getZipPrice(zipType, zipColor);
                                                    const pieces = row.totalPcs || 0;

                                                    if (price > 0 && pieces > 0) {
                                                        const itemTotal = (price * pieces) * quantity;
                                                        placementSubtotal += itemTotal;

                                                        costItems.push(
                                                            <div key={`${placement}-${color}`} className="CostItem">
                                                                <span className="CostLabel">{color} ({zipColor})</span>
                                                                <span className="CostValue">
                                                                    {pieces} pcs × {quantity} per piece × ₹{price} = ₹{itemTotal}
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                }
                                            });

                                            return (
                                                <div key={placement} style={{ marginBottom: '24px' }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        marginBottom: '12px',
                                                        padding: '12px',
                                                        background: 'var(--bg-primary, #f8fafc)',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--border-color, #e2e8f0)'
                                                    }}>
                                                        <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1rem' }}>
                                                            {placement}
                                                        </span>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                                {quantity} per piece • {zipType}
                                                            </div>
                                                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#059669' }}>
                                                                Subtotal: ₹{placementSubtotal}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {costItems.length > 0 ? (
                                                        <div style={{ marginLeft: '16px' }}>
                                                            {costItems}
                                                        </div>
                                                    ) : (
                                                        <div style={{
                                                            textAlign: 'center',
                                                            padding: '16px',
                                                            color: 'var(--text-muted)',
                                                            fontStyle: 'italic',
                                                            background: 'var(--bg-primary, #f8fafc)',
                                                            borderRadius: '8px',
                                                            marginLeft: '16px'
                                                        }}>
                                                            No zip requirements specified for this placement
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }).filter(Boolean)}

                                        {/* Grand Total */}
                                        {totalCost > 0 ? (
                                            <div className="TotalCost">
                                                <span>Grand Total Cost:</span>
                                                <span>₹{totalCost}</span>
                                            </div>
                                        ) : (
                                            <div style={{
                                                textAlign: 'center',
                                                padding: '20px',
                                                color: 'var(--text-muted)',
                                                background: 'var(--bg-primary, #f8fafc)',
                                                borderRadius: '8px',
                                                marginTop: '16px'
                                            }}>
                                                No zip costs calculated. Please ensure:
                                                <ul style={{ textAlign: 'left', margin: '12px 0', paddingLeft: '20px' }}>
                                                    <li>Zip types are selected for each placement</li>
                                                    <li>Zip colors are selected in the cutting matrix</li>
                                                    <li>Shades are not blocked by existing orders</li>
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            ) : null}

            {/* Issue dialog */}
            {/* Simple Dialog Box */}
            {showIssueDialog && (
                <>
                    <div className="Backdrop" onClick={closeIssueDialog} />
                    <div className="Dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                        <div className="DialogHeader">
                            <h3><FiPrinter /> Generate PDF</h3>
                            <button className="IconBtn" onClick={closeIssueDialog} aria-label="Close"><FiX /></button>
                        </div>

                        <label className="Field">
                            <div className="FieldLabel"><FiCalendar /> Date</div>
                            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                        </label>

                        <label className="Field">
                            <div className="FieldLabel"><FiUser /> Supervisor</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                                <input
                                    list="supervisorList"
                                    placeholder="Enter supervisor name"
                                    value={supervisor}
                                    onChange={(e) => setSupervisor(titleCase(e.target.value))}
                                />
                                {typedIsNewSupervisor && (
                                    <button
                                        type="button"
                                        onClick={() => addSupervisorToOptions(supervisor)}
                                        title="Add to suggestions"
                                        style={{
                                            whiteSpace: 'nowrap',
                                            borderRadius: 10,
                                            border: '2px solid #e2e8f0',
                                            background: '#fff',
                                            color: '#475569',
                                            fontWeight: 600,
                                            padding: '10px 12px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        + Add
                                    </button>
                                )}
                            </div>
                            <datalist id="supervisorList">
                                {supervisorOptions.map((name) => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>
                        </label>

                        {/* Priority Field */}
                        <label className="Field">
                            <div className="FieldLabel"><FiAlertTriangle /> Priority</div>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '16px 20px',
                                    borderRadius: '14px',
                                    border: '2px solid #e2e8f0',
                                    background: 'white',
                                    color: '#1e293b',
                                    outline: 'none',
                                    fontSize: '1.1rem',
                                    fontWeight: '500'
                                }}
                            >
                                <option value="Low">Low</option>
                                <option value="Normal">Normal</option>
                                <option value="High">High</option>
                                <option value="Urgent">Urgent</option>
                            </select>
                        </label>

                        {dialogError && (
                            <div className="InlineError">
                                <FiAlertTriangle />
                                <span>{dialogError}</span>
                            </div>
                        )}

                        <div className="DialogActions">
                            <button className="BaseBtn GhostBtn" type="button" onClick={closeIssueDialog} disabled={confirming}>Cancel</button>
                            <button className="BaseBtn PrimaryBtn" type="button" onClick={handleConfirmIssue} disabled={confirming} title="Generate PDF">
                                {confirming ? <div className="Spinner"></div> : <><FiDownload /> Generate PDF</>}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

import DoriOrder from './dooripogenerate';

export default function PuneetZip({ prefilledLotNo = '', setPrefilledLotNo = () => { }, initialTab = 'zip' } = {}) {
    const [activeSubTab, setActiveSubTab] = useState(initialTab);
    const [viewMode, setViewMode] = useState('dashboard');

    useEffect(() => {
        if (initialTab) {
            setActiveSubTab(initialTab);
        }
    }, [initialTab]);

    useEffect(() => {
        if (prefilledLotNo) {
            setViewMode('generator');
        }
    }, [prefilledLotNo]);

    const tabs = [
        {
            id: 'zip',
            label: 'Zip Purcharge Orders',
            subtitle: 'Manage and track all zipper material requirements',
            gradient: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
            glow: 'rgba(79, 70, 229, 0.3)',
            icon: <FiPackage />
        },
        {
            id: 'dori',
            label: 'Dori Purcharge Orders',
            subtitle: 'Manage and track all dori material requirements',
            gradient: 'linear-gradient(135deg, #0d9488, #059669)',
            glow: 'rgba(13, 148, 136, 0.3)',
            icon: <FiScissors />
        }
    ];

    const activeTabData = tabs.find(t => t.id === activeSubTab);

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary, #f8fafc)',
            fontFamily: "'Inter', system-ui, sans-serif",
        }}>
            {/* Render selected subview */}
            <div>
                {activeSubTab === 'zip' ? (
                    viewMode === 'dashboard' ? (
                        <ZipDashboard 
                            onCompileNewPO={() => setViewMode('generator')}
                            activeSubTab={activeSubTab}
                            setActiveSubTab={setActiveSubTab}
                            tabs={tabs}
                        />
                    ) : (
                        <div className="dashboard-container" style={{ padding: '20px 20px 40px 20px', width: '100%', maxWidth: '100%', margin: '0', boxSizing: 'border-box' }}>
                            {/* Generator Paper Box Header */}
                            <div style={{
                                background: 'var(--bg-secondary, #ffffff)',
                                border: '1px solid var(--border-color, #e2e8f0)',
                                borderRadius: '18px',
                                padding: '20px 24px',
                                marginBottom: '24px',
                                boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
                                position: 'relative',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '16px'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '3.5px',
                                    background: 'linear-gradient(90deg, #4f46e5, #3b82f6, #06b6d4, #4f46e5)',
                                    backgroundSize: '200% 100%'
                                }} />

                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <button
                                        onClick={() => setViewMode('dashboard')}
                                        className="BaseBtn GhostBtn"
                                        style={{
                                            padding: '8px 14px',
                                            borderRadius: '9px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '13px',
                                            fontWeight: '700',
                                            border: '1.5px solid #cbd5e1',
                                            background: '#fff',
                                            color: '#334155',
                                            cursor: 'pointer',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                    >
                                        <FiArrowLeft /> Back to Dashboard
                                    </button>
                                    <div style={{
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontSize: '20px',
                                        boxShadow: '0 6px 16px rgba(79, 70, 229, 0.35)',
                                        flexShrink: 0
                                    }}>
                                        <FiPackage />
                                    </div>
                                    <div>
                                        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main, #0f172a)', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                                            Zip Purchase Order Generator
                                        </h1>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginTop: '2px', fontWeight: '500' }}>
                                            Compile, calculate and generate zip purchase orders
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    gap: '6px',
                                    padding: '5px',
                                    background: 'var(--bg-main, #f1f5f9)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(0,0,0,0.06)',
                                    flexShrink: 0
                                }}>
                                    {tabs.map(tab => {
                                        const isActive = activeSubTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveSubTab(tab.id)}
                                                style={{
                                                    position: 'relative',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '7px 16px',
                                                    borderRadius: '9px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    background: isActive ? tab.gradient : 'transparent',
                                                    color: isActive ? '#ffffff' : 'var(--text-muted, #64748b)',
                                                    fontWeight: isActive ? '700' : '600',
                                                    fontSize: '13px',
                                                    boxShadow: isActive ? `0 4px 10px ${tab.glow}` : 'none',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                <span style={{ display: 'flex', alignItems: 'center', fontSize: '15px' }}>{tab.icon}</span>
                                                <span>{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <PuneetZipForm prefilledLotNo={prefilledLotNo} setPrefilledLotNo={setPrefilledLotNo} />
                        </div>
                    )
                ) : (
                    <DoriOrder
                        prefilledLotNo={prefilledLotNo}
                        setPrefilledLotNo={setPrefilledLotNo}
                        viewMode={viewMode}
                        setViewMode={setViewMode}
                        activeSubTab={activeSubTab}
                        setActiveSubTab={setActiveSubTab}
                        tabs={tabs}
                    />
                )}
            </div>
        </div>
    );
}

export function ZipDashboard({ 
    onCompileNewPO,
    activeSubTab = 'zip',
    setActiveSubTab = () => {},
    tabs = []
}) {
    const [poList, setPoList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGarmentType, setFilterGarmentType] = useState('All');
    const [filterSupervisor, setFilterSupervisor] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterPlacement, setFilterPlacement] = useState('All');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const backendUrl = getBackendUrl();

    const fetchDashboardData = async () => {
        setLoading(true);
        setError('');
        try {
            // Fetch directly from the zip table — only lots with real Zip PO data
            const zipRes = await fetch(`${backendUrl}/api/zip-orders`);
            if (!zipRes.ok) throw new Error('Failed to fetch Zip PO list from database');
            const data = await zipRes.json();

            // Only show entries that have a PO number (newly created entries)
            const newEntries = data.filter(row => row.po_number && String(row.po_number).trim() !== '');

            const parsedPOs = newEntries.map(row => {
                const lotNumber = String(row.Lot_Number || '').trim();
                if (!lotNumber) return null;

                // Gate entry from zip table columns (updated by scanner)
                const gatePerson = row.Gate_Entry_Person || '';
                const gateDate = row.Gate_Entry_Date
                    ? new Date(row.Gate_Entry_Date).toLocaleDateString('en-GB')
                    : '';
                const gateDone = !!gatePerson;

                const matPerson = row.Material_Received_By || '';
                const matDate = row.Material_Received_Date
                    ? new Date(row.Material_Received_Date).toLocaleDateString('en-GB')
                    : '';
                const matDone = !!matPerson;

                const supPerson = row.Supplier_Name || '';
                const supDate = row.Material_Entry_Date
                    ? new Date(row.Material_Entry_Date).toLocaleDateString('en-GB')
                    : '';
                const supDone = !!supPerson;

                // Parse placements from zip table
                let placementsStr = 'DEFAULT';
                try {
                    const pl = JSON.parse(row.Selected_Placements || '[]');
                    if (Array.isArray(pl) && pl.length > 0) placementsStr = pl.join(', ');
                } catch (_) {}

                const issueDateStr = row.Issue_Date || row.Saved_At || '';
                const aging = calculateAging(issueDateStr, gateDate, matDate, supDate);

                return {
                    id: row.id,
                    version: parseInt(row.version) || 1,
                    lotNumber,
                    garmentType: row.ch_garment || row.Garment_Type || '',
                    style: row.ch_style || row.Style || '',
                    fabric: row.ch_fabric || row.Fabric || '',
                    pieces: parseInt(row.Total_Pieces_CH || row.Total_Pieces) || 0,
                    cost: parseFloat(row.Total_Cost) || 0,
                    poNumber: row.po_number || '',
                    issueDateStr,
                    supervisor: row.Supervisor || '',
                    placements: placementsStr,
                    gatePerson,
                    gateDate,
                    gateDone,
                    matPerson,
                    matDate,
                    matDone,
                    supPerson,
                    supDate,
                    supDone,
                    agingText: aging.text,
                    agingDays: aging.days,
                    agingColor: aging.color,
                    isCompleted: gateDone && matDone && supDone
                };
            }).filter(Boolean);

            setPoList(parsedPOs);
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to load Zip PO dashboard data');
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        fetchDashboardData();
    }, []);

    const uniqueGarmentTypes = useMemo(() => {
        const set = new Set(poList.map(po => po.garmentType).filter(Boolean));
        return ['All', ...Array.from(set)];
    }, [poList]);

    const uniqueSupervisors = useMemo(() => {
        const set = new Set(poList.map(po => po.supervisor).filter(Boolean));
        return ['All', ...Array.from(set)];
    }, [poList]);

    const uniquePlacements = useMemo(() => {
        const set = new Set();
        poList.forEach(po => {
            if (po.placements) {
                po.placements.split(',').forEach(p => set.add(p.trim()));
            }
        });
        return ['All', ...Array.from(set).filter(Boolean)];
    }, [poList]);

    const filteredPOs = useMemo(() => {
        return poList.filter(po => {
            const query = searchTerm.toLowerCase().trim();
            const matchesSearch = !query ||
                po.lotNumber.toLowerCase().includes(query) ||
                po.garmentType.toLowerCase().includes(query) ||
                po.style.toLowerCase().includes(query) ||
                po.supervisor.toLowerCase().includes(query);

            const matchesGarment = filterGarmentType === 'All' || po.garmentType === filterGarmentType;
            const matchesSupervisor = filterSupervisor === 'All' || po.supervisor === filterSupervisor;

            const matchesPlacement = filterPlacement === 'All' ||
                (po.placements && po.placements.toLowerCase().includes(filterPlacement.toLowerCase()));

            let matchesStatus = true;
            if (filterStatus === 'Gate Done') matchesStatus = po.gateDone;
            else if (filterStatus === 'Gate Pending') matchesStatus = !po.gateDone;
            else if (filterStatus === 'Received Done') matchesStatus = po.matDone;
            else if (filterStatus === 'Received Pending') matchesStatus = !po.matDone;
            else if (filterStatus === 'Supplier Done') matchesStatus = po.supDone;
            else if (filterStatus === 'Supplier Pending') matchesStatus = !po.supDone;
            else if (filterStatus === 'Completed') matchesStatus = po.isCompleted;
            else if (filterStatus === 'Pending') matchesStatus = !po.isCompleted;

            let matchesDate = true;
            if (po.issueDateStr) {
                const poDate = new Date(po.issueDateStr);
                if (dateFrom) {
                    const fromDate = new Date(dateFrom);
                    if (poDate < fromDate) matchesDate = false;
                }
                if (dateTo) {
                    const toDate = new Date(dateTo);
                    if (poDate > toDate) matchesDate = false;
                }
            }

            return matchesSearch && matchesGarment && matchesSupervisor && matchesPlacement && matchesStatus && matchesDate;
        });
    }, [poList, searchTerm, filterGarmentType, filterSupervisor, filterPlacement, filterStatus, dateFrom, dateTo]);

    const stats = useMemo(() => {
        const total = poList.length;
        const gateDoneCount = poList.filter(po => po.gateDone).length;
        const matReceivedCount = poList.filter(po => po.matDone).length;
        const supplierEntryCount = poList.filter(po => po.supDone).length;

        return { total, gateDoneCount, matReceivedCount, supplierEntryCount };
    }, [poList]);

    const paginatedPOs = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredPOs.slice(start, start + rowsPerPage);
    }, [filteredPOs, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(filteredPOs.length / rowsPerPage) || 1;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterGarmentType, filterSupervisor, filterStatus, filterPlacement, dateFrom, dateTo]);

    const handleClearFilters = () => {
        setSearchTerm('');
        setFilterGarmentType('All');
        setFilterSupervisor('All');
        setFilterStatus('All');
        setFilterPlacement('All');
        setDateFrom('');
        setDateTo('');
    };

    const downloadCSV = () => {
        const csvHeaders = ['SR. NO.', 'LOT NO.', 'VERSION', 'GARMENT TYPE', 'STYLE', 'PIECES', 'COST', 'ISSUE DATE', 'SUPERVISOR', 'ZIP PLACEMENTS', 'GATE ENTRY', 'MATERIAL RECEIVED', 'SUPPLIER', 'AGING'];
        const csvRows = filteredPOs.map((po, index) => [
            index + 1,
            po.lotNumber,
            `V${po.version}`,
            po.garmentType,
            po.style,
            po.pieces,
            po.cost,
            po.issueDateStr,
            po.supervisor,
            po.placements,
            po.gateDone ? `Done (${po.gatePerson} ${po.gateDate})` : 'Pending',
            po.matDone ? `Received (${po.matPerson} ${po.matDate})` : 'Pending',
            po.supDone ? `Entered (${po.supPerson} ${po.supDate})` : 'Pending',
            po.agingText
        ]);

        const csvContent = [csvHeaders, ...csvRows]
            .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
            .join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Zip_POs_Report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(`Zip Purchase Orders Report`, 14, 15);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, 14, 20);

        const tableData = filteredPOs.map((po, index) => [
            index + 1,
            po.lotNumber,
            `V${po.version}`,
            po.garmentType,
            po.style,
            po.pieces,
            `₹${po.cost.toLocaleString('en-IN')}`,
            po.issueDateStr,
            po.supervisor,
            po.placements,
            po.gateDone ? 'Done' : 'Pending',
            po.matDone ? 'Received' : 'Pending',
            po.supDone ? 'Entered' : 'Pending',
            po.agingText
        ]);

        autoTable(doc, {
            head: [['SR.', 'LOT', 'VER.', 'GARMENT', 'STYLE', 'QTY', 'COST', 'DATE', 'SUPERVISOR', 'PLACEMENTS', 'GATE', 'RECEIVE', 'SUPPLIER', 'AGING']],
            body: tableData,
            startY: 25,
            theme: 'striped',
            styles: { fontSize: 7.5 },
            headStyles: { fillColor: [124, 58, 237] }
        });

        doc.save(`Zip_POs_Report.pdf`);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px', background: '#f8fafc', minHeight: '60vh' }}>
                <div className="Spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '16px', color: '#64748b', fontSize: '15px', fontWeight: '500' }}>Loading Zip Purcharge Orders Dashboard data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '40px', maxWidth: '800px', margin: '40px auto', background: '#fff', borderRadius: '12px', border: '1px solid #fee2e2', textAlign: 'center' }}>
                <FiAlertTriangle style={{ fontSize: '48px', color: '#ef4444', marginBottom: '16px' }} />
                <h3 style={{ color: '#991b1b', margin: '0 0 8px 0' }}>Dashboard Error</h3>
                <p style={{ color: '#7f1d1d', margin: '0 0 20px 0' }}>{error}</p>
                <button onClick={fetchDashboardData} className="BaseBtn PrimaryBtn" style={{ margin: '0 auto' }}>Retry Loading</button>
            </div>
        );
    }

    const defaultTabs = [
        {
            id: 'zip',
            label: 'Zip Purcharge Orders',
            subtitle: 'Manage and track all zipper material requirements',
            gradient: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
            glow: 'rgba(79, 70, 229, 0.3)',
            icon: <FiPackage />
        },
        {
            id: 'dori',
            label: 'Dori Purcharge Orders',
            subtitle: 'Manage and track all dori material requirements',
            gradient: 'linear-gradient(135deg, #0d9488, #059669)',
            glow: 'rgba(13, 148, 136, 0.3)',
            icon: <FiScissors />
        }
    ];
    const displayTabs = tabs && tabs.length > 0 ? tabs : defaultTabs;

    return (
        <div className="dashboard-container" style={{ padding: '20px 20px 40px 20px', width: '100%', maxWidth: '100%', margin: '0', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif" }}>
            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .dashboard-card {
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 22px 24px;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }
                .dashboard-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 12px 20px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.03);
                }
                .dashboard-card-icon {
                    width: 52px;
                    height: 52px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    box-shadow: inset 0 2px 4px rgba(255,255,255,0.2);
                }
                .filter-label {
                    font-size: 11px;
                    font-weight: 700;
                    color: #475569;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    margin-bottom: 6px;
                }
                .filter-select {
                    padding: 9px 12px;
                    border: 1.5px solid #cbd5e1;
                    border-radius: 10px;
                    background: #fff;
                    color: #334155;
                    font-size: 13px;
                    outline: none;
                    cursor: pointer;
                    width: 100%;
                    box-sizing: border-box;
                    transition: all 0.2s;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
                }
                .filter-select:focus {
                    border-color: #7c3aed;
                    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
                }
                .po-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12.5px;
                    text-align: left;
                }
                .po-table th {
                    background: #f8fafc;
                    padding: 14px 12px;
                    color: #475569;
                    font-weight: 700;
                    border-bottom: 2px solid #e2e8f0;
                    text-transform: uppercase;
                    font-size: 10px;
                    letter-spacing: 0.06em;
                }
                .po-table td {
                    padding: 14px 12px;
                    border-bottom: 1px solid #e2e8f0;
                    vertical-align: middle;
                    color: #334155;
                    transition: background 0.15s;
                }
                .po-table tr:hover td {
                    background: #f8fafc;
                }
                .status-subtext {
                    font-size: 10px;
                    color: #64748b;
                    margin-top: 2px;
                    display: block;
                }
                .badge-pill {
                    padding: 4px 10px;
                    border-radius: 8px;
                    font-weight: 700;
                    font-size: 10.5px;
                    display: inline-block;
                }
            `}</style>

            {/* ── Paper Box Header: Branding, Tabs & Quick Actions ── */}
            <div style={{
                background: 'var(--bg-secondary, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '18px',
                padding: '22px 26px',
                marginBottom: '24px',
                boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
            }}>
                {/* Decorative top accent line */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3.5px',
                    background: 'linear-gradient(90deg, #4f46e5, #3b82f6, #06b6d4, #4f46e5)',
                    backgroundSize: '200% 100%'
                }} />

                {/* Top Row: Title, Icon, Subtitle & Tab Switcher */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '13px',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '22px',
                            boxShadow: '0 6px 16px rgba(79, 70, 229, 0.35)',
                            flexShrink: 0
                        }}>
                            <FiPackage />
                        </div>
                        <div>
                            <h1 style={{
                                margin: 0,
                                fontSize: '19px',
                                fontWeight: '800',
                                color: 'var(--text-main, #0f172a)',
                                letterSpacing: '-0.3px',
                                fontFamily: "'Outfit', 'Inter', sans-serif"
                            }}>
                                Zip Purcharge Orders Dashboard
                            </h1>
                            <div style={{
                                fontSize: '12px',
                                color: 'var(--text-muted, #64748b)',
                                marginTop: '2px',
                                fontWeight: '500'
                            }}>
                                Manage and track all zipper material requirements
                            </div>
                        </div>
                    </div>

                    {/* Right Tab Switcher Pills */}
                    <div style={{
                        display: 'flex',
                        gap: '6px',
                        padding: '5px',
                        background: 'var(--bg-main, #f1f5f9)',
                        borderRadius: '12px',
                        border: '1px solid rgba(0,0,0,0.06)',
                        flexShrink: 0
                    }}>
                        {displayTabs.map(tab => {
                            const isActive = activeSubTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveSubTab(tab.id)}
                                    style={{
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '7px 16px',
                                        borderRadius: '9px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                        background: isActive ? tab.gradient : 'transparent',
                                        color: isActive ? '#ffffff' : 'var(--text-muted, #64748b)',
                                        fontWeight: isActive ? '700' : '600',
                                        fontSize: '13px',
                                        letterSpacing: '0.2px',
                                        boxShadow: isActive ? `0 4px 10px ${tab.glow}` : 'none',
                                        transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', fontSize: '15px' }}>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Soft Divider */}
                <div style={{ height: '1px', background: 'var(--border-color, #e2e8f0)', width: '100%' }} />

                {/* Bottom Row: Actions Bar */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <button
                        onClick={onCompileNewPO}
                        className="BaseBtn PrimaryBtn"
                        style={{
                            background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                            color: '#fff',
                            fontWeight: '700',
                            fontSize: '13px',
                            padding: '10px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        <FiPlus size={16} /> Compile New Purchase Order
                    </button>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button onClick={downloadPDF} className="BaseBtn" style={{ padding: '9px 15px', borderRadius: '10px', border: '1.5px solid #fecdd3', background: '#ffffff', color: '#e11d48', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', boxShadow: '0 1px 3px rgba(225, 29, 72, 0.08)' }}>
                            <FiPrinter size={15} /> PDF Report
                        </button>
                        <button onClick={downloadCSV} className="BaseBtn" style={{ padding: '9px 15px', borderRadius: '10px', border: '1.5px solid #a7f3d0', background: '#ffffff', color: '#059669', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', boxShadow: '0 1px 3px rgba(5, 150, 105, 0.08)' }}>
                            <FiDownload size={15} /> Excel/CSV
                        </button>
                        <button onClick={fetchDashboardData} className="BaseBtn" style={{ padding: '9px 15px', borderRadius: '10px', border: '1.5px solid #c7d2fe', background: '#ffffff', color: '#4f46e5', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', boxShadow: '0 1px 3px rgba(79, 70, 229, 0.08)' }}>
                            <FiRefreshCw size={14} /> Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(79, 70, 229, 0.18)' }}>
                    <div className="dashboard-card-icon" style={{ background: '#eef2ff', color: '#4f46e5', border: '1px solid #e0e7ff' }}><FiPackage /></div>
                    <div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', fontFamily: "'Outfit', 'Inter', sans-serif" }}>{stats.total}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Total Orders</div>
                    </div>
                </div>
                <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(16, 185, 129, 0.18)' }}>
                    <div className="dashboard-card-icon" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #d1fae5' }}><FiCheckSquare /></div>
                    <div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', fontFamily: "'Outfit', 'Inter', sans-serif" }}>{stats.gateDoneCount}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Gate Entry Done</div>
                    </div>
                </div>
                <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(2, 132, 199, 0.18)' }}>
                    <div className="dashboard-card-icon" style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #e0f2fe' }}><FiTruck /></div>
                    <div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', fontFamily: "'Outfit', 'Inter', sans-serif" }}>{stats.matReceivedCount}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Material Received</div>
                    </div>
                </div>
                <div className="dashboard-card" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(124, 58, 237, 0.18)' }}>
                    <div className="dashboard-card-icon" style={{ background: '#faf5ff', color: '#7c3aed', border: '1px solid #f3e8ff' }}><FiUser /></div>
                    <div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', fontFamily: "'Outfit', 'Inter', sans-serif" }}>{stats.supplierEntryCount}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Supplier Entry</div>
                    </div>
                </div>
            </div>

            {/* Filter Panel */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '18px', marginBottom: '20px', boxShadow: 'var(--shadow-sm)' }}>
                {/* Search */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <FiSearch style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)', fontSize: '16px' }} />
                    <input
                        type="text"
                        placeholder="Search across all orders by lot, style, supervisor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 14px 10px 40px',
                            border: '1.5px solid var(--border-color)',
                            borderRadius: '10px',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-main)',
                            fontSize: '13px',
                            outline: 'none',
                            transition: 'all 0.2s',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                {/* Dropdowns Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', alignItems: 'end' }}>
                    <div>
                        <div className="filter-label">Garment Type</div>
                        <select className="filter-select" value={filterGarmentType} onChange={(e) => setFilterGarmentType(e.target.value)}>
                            {uniqueGarmentTypes.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="filter-label">Supervisor</div>
                        <select className="filter-select" value={filterSupervisor} onChange={(e) => setFilterSupervisor(e.target.value)}>
                            {uniqueSupervisors.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="filter-label">Status</div>
                        <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="All">All Status</option>
                            <option value="Gate Done">Gate Entry Done</option>
                            <option value="Gate Pending">Gate Entry Pending</option>
                            <option value="Received Done">Material Received Done</option>
                            <option value="Received Pending">Material Received Pending</option>
                            <option value="Supplier Done">Supplier Entry Done</option>
                            <option value="Supplier Pending">Supplier Entry Pending</option>
                            <option value="Completed">All Completed</option>
                            <option value="Pending">All Pending</option>
                        </select>
                    </div>
                    <div>
                        <div className="filter-label">Zip Placement</div>
                        <select className="filter-select" value={filterPlacement} onChange={(e) => setFilterPlacement(e.target.value)}>
                            {uniquePlacements.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="filter-label">Date From</div>
                        <input type="date" className="filter-select" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                        <div className="filter-label">Date To</div>
                        <input type="date" className="filter-select" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                    <div>
                        <button
                            onClick={handleClearFilters}
                            className="BaseBtn"
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1.5px solid #e2e8f0',
                                borderRadius: '10px',
                                background: '#f8fafc',
                                color: '#64748b',
                                fontWeight: '700',
                                cursor: 'pointer',
                                fontSize: '13px',
                                height: '38px',
                                boxSizing: 'border-box',
                                transition: 'all 0.2s'
                            }}
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="po-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>Sr. No.</th>
                                <th>Lot No.</th>
                                <th style={{ width: '60px', textAlign: 'center' }}>Ver.</th>
                                <th>PO No.</th>
                                <th>Garment Type</th>
                                <th>Style</th>
                                <th>Pieces</th>
                                <th>Cost</th>
                                <th>Issue Date</th>
                                <th>Supervisor</th>
                                <th>Zip Placements</th>
                                <th>Gate Entry</th>
                                <th>Material Received</th>
                                <th>Supplier</th>
                                <th>Aging</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedPOs.length === 0 ? (
                                <tr>
                                    <td colSpan="14" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                                        No purchase orders found matching the filter criteria.
                                    </td>
                                </tr>
                            ) : (
                                paginatedPOs.map((po, index) => {
                                    const serialNo = (currentPage - 1) * rowsPerPage + index + 1;
                                    const isMultiVersion = poList.filter(p => p.lotNumber === po.lotNumber).length > 1;
                                    return (
                                        <tr key={po.id || `${po.lotNumber}-v${po.version}`}>
                                            <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--text-muted)' }}>{serialNo}</td>
                                            <td>
                                                <span style={{ fontWeight: '800', color: '#0f172a', background: '#eef2ff', border: '1px solid #e0e7ff', padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>
                                                    {po.lotNumber}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    background: isMultiVersion
                                                        ? (po.version === 1 ? '#eff6ff' : '#ecfdf5')
                                                        : 'rgba(100,116,139,0.08)',
                                                    color: isMultiVersion
                                                        ? (po.version === 1 ? '#2563eb' : '#059669')
                                                        : '#64748b',
                                                    border: `1px solid ${isMultiVersion ? (po.version === 1 ? '#bfdbfe' : '#a7f3d0') : 'rgba(100,116,139,0.2)'}`
                                                }}>
                                                    V{po.version}
                                                </span>
                                            </td>
                                            <td>
                                                {po.poNumber
                                                    ? <span style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '6px', fontFamily: 'monospace', fontWeight: '700', fontSize: '11px' }}>{po.poNumber}</span>
                                                    : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                                                }
                                            </td>
                                            <td style={{ fontWeight: '600' }}>
                                                {po.garmentType}
                                                {po.fabric && <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>{po.fabric}</span>}
                                            </td>
                                            <td>{po.style}</td>
                                            <td style={{ fontWeight: '700' }}>{po.pieces.toLocaleString()}</td>
                                            <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>₹{po.cost.toLocaleString('en-IN')}</td>
                                            <td>{po.issueDateStr ? formatDate(po.issueDateStr) : '—'}</td>
                                            <td style={{ fontWeight: '600' }}>{po.supervisor}</td>
                                            <td>
                                                {po.placements ? (
                                                    <span style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: '8px', fontSize: '10.5px', color: 'var(--text-main)', fontWeight: '700' }}>
                                                        {po.placements}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td>
                                                {po.gateDone ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--success-light)', color: 'var(--success)', border: '1px solid var(--success)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700', alignSelf: 'start' }}>
                                                            <FiCheck /> Done
                                                        </div>
                                                        <span className="status-subtext" style={{ fontWeight: '600' }}>{po.gatePerson}</span>
                                                        <span className="status-subtext" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{po.gateDate}</span>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--warning-light)', color: 'var(--warning)', border: '1px solid var(--warning)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700' }}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warning)' }}></span>
                                                        Pending
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {po.matDone ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--success-light)', color: 'var(--success)', border: '1px solid var(--success)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700', alignSelf: 'start' }}>
                                                            <FiCheck /> Received
                                                        </div>
                                                        <span className="status-subtext" style={{ fontWeight: '600' }}>{po.matPerson}</span>
                                                        <span className="status-subtext" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{po.matDate}</span>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--warning-light)', color: 'var(--warning)', border: '1px solid var(--warning)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700' }}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warning)' }}></span>
                                                        Pending
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {po.supDone ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--success-light)', color: 'var(--success)', border: '1px solid var(--success)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700', alignSelf: 'start' }}>
                                                            <FiCheck /> Entered
                                                        </div>
                                                        <span className="status-subtext" style={{ fontWeight: '600' }}>{po.supPerson}</span>
                                                        <span className="status-subtext" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{po.supDate}</span>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--warning-light)', color: 'var(--warning)', border: '1px solid var(--warning)', padding: '3px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: '700' }}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warning)' }}></span>
                                                        Pending
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span className="badge-pill" style={{ background: `${po.agingColor}15`, color: po.agingColor, border: `1px solid ${po.agingColor}30` }}>
                                                    {po.agingText}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredPOs.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredPOs.length)} of {filteredPOs.length} entries
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="BaseBtn"
                                    style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '12px', color: currentPage === 1 ? '#94a3b8' : '#334155' }}
                                >
                                    Previous
                                </button>
                                <span style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '600' }}>Page {currentPage} of {totalPages}</span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="BaseBtn"
                                    style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '12px', color: currentPage === totalPages ? '#94a3b8' : '#334155' }}
                                >
                                    Next
                                </button>
                            </div>
                            <select
                                className="filter-select"
                                value={rowsPerPage}
                                onChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                                style={{ width: '100px', padding: '5px' }}
                            >
                                <option value={10}>10 per page</option>
                                <option value={25}>25 per page</option>
                                <option value={50}>50 per page</option>
                                <option value={100}>100 per page</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const calculateAging = (issueDateStr, gateDateStr, matDateStr, supDateStr) => {
    if (!issueDateStr) return { days: 0, text: '0 days', color: '#64748b' };

    const parseDate = (dStr) => {
        if (!dStr) return null;
        const str = dStr.trim();
        if (str.includes('-')) {
            const parts = str.split('-');
            if (parts.length === 3) {
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
        }
        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) {
                const p0 = parseInt(parts[0]);
                const p1 = parseInt(parts[1]);
                const p2 = parseInt(parts[2]);
                return new Date(p2, p0 - 1, p1);
            }
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    };

    const issueDate = parseDate(issueDateStr);
    if (!issueDate) return { days: 0, text: '0 days', color: '#64748b' };

    const isCompleted = gateDateStr && matDateStr && supDateStr;
    let endDate = new Date();

    if (isCompleted) {
        const gateDate = parseDate(gateDateStr) || new Date(0);
        const matDate = parseDate(matDateStr) || new Date(0);
        const supDate = parseDate(supDateStr) || new Date(0);
        endDate = new Date(Math.max(gateDate.getTime(), matDate.getTime(), supDate.getTime()));
    }

    const diffTime = endDate.getTime() - issueDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    let color = '#10b981';
    let text = `${diffDays} days${isCompleted ? ' Completed' : ''}`;

    if (diffDays <= 2) {
        color = '#10b981';
    } else if (diffDays <= 5) {
        color = '#0d9488';
    } else if (diffDays <= 10) {
        color = '#8b5cf6';
    } else {
        color = '#ef4444';
    }

    return { days: diffDays, text, color };
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const dateOnlyStr = dateStr.includes(' ') ? dateStr.split(' ')[0] : dateStr.trim();
        if (dateOnlyStr.includes('-')) {
            const parts = dateOnlyStr.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
                }
            }
        }
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const pad = n => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    } catch {
        return dateStr;
    }
};

const getLotVersionInfo = (lotNo) => {
    const lotStr = String(lotNo || '').trim();
    if (lotStr.includes('-V')) {
        const parts = lotStr.split('-V');
        return {
            displayLot: parts[0],
            versionText: `Recreated (Run ${parts[1]})`,
            isRecreated: true
        };
    }
    return {
        displayLot: lotStr,
        versionText: 'Original (Run 1)',
        isRecreated: false
    };
};
