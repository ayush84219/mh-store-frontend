import { getBackendUrl } from '../utils/api';
import { useState, useEffect } from 'react';
import { Layers3, PlusCircle, Trash2, Tag, Search, Database, Printer, Scissors, Image as ImageIcon, ImageOff, ExternalLink } from 'lucide-react';

import { getCleanImageUrl, getGoogleDrivePreviewUrl, formatDesignTime, GARMENT_CATEGORIES } from '../utils/designHelpers';
export { getCleanImageUrl, getGoogleDrivePreviewUrl, formatDesignTime, GARMENT_CATEGORIES };

export const findMatchingMaterialId = (bomItem, materials) => {
  const detailLower = (bomItem.detail || '').toLowerCase();
  const nameLower = (bomItem.name || '').toLowerCase();

  // Determine description: use description field, or if empty, check if detail is a text string (not numeric)
  const descLower = (bomItem.description || '').trim().toLowerCase() ||
    (!/^\d+(\.\d+)?$/.test(detailLower.trim()) ? detailLower.trim() : '');

  if (!descLower) return "";

  let bestMaterial = null;
  let highestScore = 0;

  materials.forEach(m => {
    const mName = m.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const bName = nameLower.replace(/[^a-z0-9\s]/g, '');
    const bDesc = descLower.replace(/[^a-z0-9\s]/g, '');

    let score = 0;

    // Clean alphanumeric matches (ignoring spaces/special chars entirely)
    const cleanStr = str => str.replace(/\s+/g, '');
    const mClean = cleanStr(mName);
    const bDescClean = cleanStr(bDesc);

    if (mClean && bDescClean) {
      if (mClean === bDescClean) {
        score += 100; // Perfect match on description (e.g. "buttonnew1" vs "buttonnew1")
      } else if (mClean.includes(bDescClean) || bDescClean.includes(mClean)) {
        score += 80;
      }
    }

    // Word-by-word overlap match for description
    const mWords = mName.split(/\s+/).filter(Boolean);
    const bDescWords = bDesc.split(/\s+/).filter(Boolean);
    if (mWords.length > 0 && bDescWords.length > 0) {
      let matchedDescWords = 0;
      bDescWords.forEach(w => {
        if (mName.includes(w)) {
          matchedDescWords++;
        }
      });
      if (matchedDescWords > 0) {
        score += (matchedDescWords / bDescWords.length) * 50;
      }
    }

    // Base matching on standard BOM item category/name (e.g. "button" or "zip")
    if (bName && mName.includes(bName)) {
      score += 10;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMaterial = m;
    }
  });

  // Set mapped material if score is significant (e.g. score >= 15)
  if (highestScore >= 15 && bestMaterial) {
    return bestMaterial.id;
  }

  return "";
};

// Inline SVG sketches for premium placeholders
const GarmentSketch = ({ category, color = '#6b7280' }) => {
  const catLower = (category || '').toLowerCase();

  if (
    catLower.includes('jacket') ||
    catLower.includes('windcheater') ||
    (catLower.includes('track suit') && !catLower.includes('+'))
  ) {
    // Jacket / Outerwear shape
    return (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Jacket body & long sleeves */}
        <path d="M 22,30 L 35,16 L 65,16 L 78,30 L 72,78 L 68,78 L 68,85 L 32,85 L 32,78 L 28,78 Z" />
        {/* Long sleeves lines */}
        <path d="M 32,38 L 24,78 M 68,38 L 76,78" />
        {/* Collar stand */}
        <path d="M 38,16 L 38,24 L 62,24 L 62,16 Z" />
        {/* Front zipper line */}
        <line x1="50" y1="24" x2="50" y2="85" strokeWidth="2" />
        {/* Zipper pull */}
        <rect x="48" y="32" width="4" height="6" rx="1" fill={color} />
        {/* Side pockets */}
        <path d="M 35,62 H 44 M 65,62 H 56" />
      </svg>
    );
  } else if (
    catLower.includes('collar') ||
    catLower.includes('shirt') ||
    catLower.includes('upper')
  ) {
    // Collared Shirt shape (with flaps & button line)
    return (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Body and sleeves */}
        <path d="M 20,32 L 35,20 L 65,20 L 80,32 L 72,48 L 66,45 L 66,85 L 34,85 L 34,45 L 28,48 Z" />
        {/* Collar flaps */}
        <path d="M 35,20 L 50,30 L 65,20" />
        <path d="M 42,20 L 50,30 L 58,20" />
        {/* Button placket */}
        <line x1="50" y1="30" x2="50" y2="58" />
        <circle cx="50" cy="38" r="1.5" fill={color} />
        <circle cx="50" cy="48" r="1.5" fill={color} />
      </svg>
    );
  } else if (
    catLower.includes('lower') ||
    catLower.includes('jogger') ||
    catLower.includes('nikker')
  ) {
    // Bottomwear shape
    return (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 30,15 H 70 L 75,40 L 70,85 L 52,85 L 50,48 L 48,85 L 30,85 L 25,40 Z" />
        <line x1="30" y1="23" x2="70" y2="23" />
        {/* Pocket openings */}
        <path d="M 30,32 L 36,40 M 70,32 L 64,40" />
      </svg>
    );
  } else {
    // Round Neck T-Shirt shape (T-shirt R/N, sweatshirt R/N, sweatshirt hoodie, dropshoulder, sandow, etc.)
    return (
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Tee body and short sleeves */}
        <path d="M 20,30 L 35,20 L 42,27 A 10,10 0 0,0 58,27 L 65,20 L 80,30 L 72,48 L 66,45 L 66,85 L 34,85 L 34,45 L 28,48 Z" />
        {/* Round collar line */}
        <path d="M 42,27 A 10,10 0 0,0 58,27" />
      </svg>
    );
  }
};

const DEFAULT_ACCESSORY_BOM = [
  { name: 'Zip', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Button', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Elastic', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Tape / Lace', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Rib', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Collar', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Sticker / Label', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Thread', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Pocket', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Drawstring / Nara', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Hook, buckle, velcro', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Interlining / fusing', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Bone', status: 'No', detail: '', description: '', materialId: '' },
  { name: 'Full Baju', status: 'No', detail: '', description: '', materialId: '' }
];

const isSheetValueYes = (val) => {
  if (val === undefined || val === null) return false;
  const s = String(val).trim().toUpperCase();
  if (!s || ['NO', 'N', 'NONE', 'N/A', 'NA', 'FALSE', '-', '0'].includes(s)) {
    return false;
  }
  return true;
};

const extractInteger = (str) => {
  if (!str) return '1';
  const match = String(str).match(/\d+/);
  return match ? match[0] : '1';
};

const getSheetDescription = (val, defaultFallback = '') => {
  if (!val) return defaultFallback;
  const s = String(val).trim();
  const upper = s.toUpperCase();
  if (['YES', 'Y', 'TRUE', '1'].includes(upper)) {
    return defaultFallback;
  }
  return s;
};

const getAccessorySheetValue = (accName, lotData) => {
  if (!lotData) return '';
  const norm = (accName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (norm.includes('zip')) return lotData.zip;
  if (norm.includes('button')) return lotData.button;
  if (norm.includes('collar')) return lotData.collar;
  if (norm.includes('tapelace') || norm.includes('tape') || norm.includes('lace')) return lotData.tapeLace;
  if (norm.includes('bone') || norm.includes('piping')) return lotData.bone;
  if (norm.includes('fullbaju') || norm.includes('baju') || norm.includes('sleeve')) return lotData.fullBaju;
  if (norm.includes('elastic')) {
    if (lotData.bottomType && lotData.bottomType.toLowerCase().includes('elastic')) return lotData.bottomType;
    return lotData.elastic || '';
  }
  if (norm.includes('rib')) {
    if (lotData.bottomType && lotData.bottomType.toLowerCase().includes('rib')) return lotData.bottomType;
    return lotData.rib || '';
  }
  if (norm.includes('sticker') || norm.includes('label')) {
    return lotData.sticker || lotData.label;
  }
  if (norm.includes('tag')) return lotData.tag;
  if (norm.includes('dori') || norm.includes('drawstring') || norm.includes('nara')) {
    return lotData.dori || lotData.drawstring;
  }
  if (norm.includes('pocket')) return lotData.pocket;
  if (norm.includes('thread')) return lotData.thread;
  if (norm.includes('hook') || norm.includes('buckle') || norm.includes('velcro')) return lotData.hook;
  if (norm.includes('interlining') || norm.includes('fusing')) return lotData.fusing;

  if (lotData[accName] !== undefined && lotData[accName] !== null) return lotData[accName];
  if (lotData.rawRow) {
    const rawKeys = Object.keys(lotData.rawRow);
    const matchedKey = rawKeys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
    if (matchedKey) return lotData.rawRow[matchedKey];
  }
  return '';
};

const createDefaultBomItems = (accList = [], matList = []) => {
  const baseList = (accList && accList.length > 0) ? accList : [
    'Zip', 'Button', 'Elastic', 'Tape / Lace', 'Rib', 'Collar',
    'Sticker / Label', 'Thread', 'Pocket', 'Drawstring / Nara',
    'Hook, buckle, velcro', 'Interlining / fusing', 'Bone', 'Full Baju'
  ];
  const uniqueNames = [...new Set(baseList)];
  return uniqueNames.map(name => ({
    name,
    status: 'No',
    detail: '',
    description: '',
    materialId: ''
  }));
};

export default function DesignView({
  designs = [],
  materials = [],
  onAddDesign,
  currencySymbol = 'R',
  accessoriesList = [],
  designersList = [],
  onRedirectToTab,
  prefilledLotNo,
  setPrefilledLotNo
}) {
  const [selectedDesignId, setSelectedDesignId] = useState(designs?.[0]?.id || null);
  const [printingDesign, setPrintingDesign] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingDesignId, setEditingDesignId] = useState(null);
  const [submitStatus, setSubmitStatus] = useState('In Verification');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [filterStatus, setFilterStatus] = useState('all');
  const [imageError, setImageError] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [formImageError, setFormImageError] = useState(false);

  // Auto-handle prefilled lot number (from Undesigned Lots / OnlyCutting)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const lotFromUrl = urlParams.get('lot');
    const targetLot = prefilledLotNo || lotFromUrl;

    if (targetLot) {
      setIsCreating(true);
      setEditingDesignId(null);
      setLotNo(targetLot);
      // Small timeout to allow state to initialize
      const timer = setTimeout(() => {
        handleFetchLotData(targetLot, true);
      }, 150);
      if (setPrefilledLotNo) setPrefilledLotNo('');
      return () => clearTimeout(timer);
    }
  }, [prefilledLotNo]);


  useEffect(() => {
    setImageError(false);
    setIsImageLoading(true);
  }, [selectedDesignId]);

  // Set default selected Lot to the latest one if not already set or invalid
  useEffect(() => {
    if (designs && designs.length > 0) {
      const sorted = [...designs].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        const numA = parseInt(a.id, 10);
        const numB = parseInt(b.id, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numB - numA;
        }
        return (b.id || '').localeCompare(a.id || '');
      });
      if (!selectedDesignId || !designs.some(d => d.id === selectedDesignId)) {
        setSelectedDesignId(sorted[0]?.id);
      }
    }
  }, [designs, selectedDesignId]);

  // Sheet fetch state
  const [isFetching, setIsFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState({ type: '', text: '' });
  const [lastFetchedLotNo, setLastFetchedLotNo] = useState('');

  const sortedDesigns = [...(designs || [])].sort((a, b) => {
    if (sortBy === 'latest') {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA;
      }
      return b.id.localeCompare(a.id);
    } else if (sortBy === 'lotNoDesc') {
      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA;
      }
      return b.id.localeCompare(a.id);
    } else if (sortBy === 'lotNoAsc') {
      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.id.localeCompare(b.id);
    }
    return 0;
  });

  const cleanSearchQuery = searchQuery.toLowerCase().trim();
  const statusFiltered = filterStatus === 'all'
    ? sortedDesigns
    : sortedDesigns.filter(d => d.status.toLowerCase().trim() === filterStatus.toLowerCase().trim());

  const filteredDesigns = cleanSearchQuery
    ? statusFiltered.filter(design => {
      const id = String(design.id || '').toLowerCase();
      const lotNo2 = String(design.lotNo2 || '').toLowerCase();
      const brand = String(design.brand || '').toLowerCase();
      const style = String(design.style || '').toLowerCase();
      const category = String(design.category || '').toLowerCase();
      const fabric = String(design.fabricType || '').toLowerCase();
      const designer = String(design.designer || '').toLowerCase();
      const repeatAgainst = String(design.repeat_against || '').toLowerCase();

      return (
        id.includes(cleanSearchQuery) ||
        (lotNo2 !== 'n/a' && lotNo2.includes(cleanSearchQuery)) ||
        brand.includes(cleanSearchQuery) ||
        style.includes(cleanSearchQuery) ||
        category.includes(cleanSearchQuery) ||
        fabric.includes(cleanSearchQuery) ||
        designer.includes(cleanSearchQuery) ||
        repeatAgainst.includes(cleanSearchQuery)
      );
    })
    : statusFiltered.slice(0, 10);

  // Auto-calculate next Lot No for preview in form
  const getNextLotNo = () => {
    const numericIds = designs.map(d => parseInt(d.id, 10)).filter(id => !isNaN(id) && id >= 30000 && id < 60000);
    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
    return maxId >= 30000 ? maxId + 1 : 30000;
  };

  // New design form state (no name — Lot No IS the name)
  const [category, setCategory] = useState('T-SHIRT R/N');
  const [designer, setDesigner] = useState('Admin');
  const [fabricType, setFabricType] = useState('Cotton Blend');
  const [targetSizes, setTargetSizes] = useState(['M']);
  const [colorCode, setColorCode] = useState('#3b82f6');
  const [quantity, setQuantity] = useState(100);

  // Expanded fields state
  const [lotNo, setLotNo] = useState('');
  const [lotNo2, setLotNo2] = useState('');
  const [brand, setBrand] = useState('');

  const handleBrandChange = (newBrand) => {
    setBrand(newBrand);
  };
  const [style, setStyle] = useState('');
  const [section, setSection] = useState('Men');
  const [season, setSeason] = useState('Summer');
  const [imageUrl, setImageUrl] = useState('');

  // Accessories states
  const [tapeLace, setTapeLace] = useState('No');
  const [bottomType, setBottomType] = useState('N/A');
  const [zip, setZip] = useState('No');
  const [sticker, setSticker] = useState('No');
  const [collar, setCollar] = useState('No');
  const [bone, setBone] = useState('No');
  const [fullBaju, setFullBaju] = useState('No');

  // New design BOM items state
  const [bomItems, setBomItems] = useState(() => createDefaultBomItems(accessoriesList, materials));

  const [showAddInline, setShowAddInline] = useState(false);
  const [newInlineName, setNewInlineName] = useState('');
  const [accessoryError, setAccessoryError] = useState('');

  const handleStartCreating = () => {
    setBomItems(createDefaultBomItems(accessoriesList, materials));
    setIsCreating(true);
    setEditingDesignId(null);
    setShowAddInline(false);
    setNewInlineName('');
    setImageUrl('');
    setFormImageError(false);
    setLastFetchedLotNo('');
    // Reset values to defaults
    setCategory('T-SHIRT R/N');
    setDesigner(designersList[0] || 'Admin');
    setFabricType('Cotton Blend');
    setTargetSizes(['M']);
    setColorCode('#3b82f6');
    setQuantity(100);
    setLotNo('');
    setLotNo2('');
    setBrand('');
    setStyle('');
    setSection('Men');
    setSeason('Summer');
  };

  const handleCancelCreating = () => {
    setIsCreating(false);
    setEditingDesignId(null);
    setShowAddInline(false);
    setNewInlineName('');
    setImageUrl('');
    setFormImageError(false);
    setLastFetchedLotNo('');
    // Reset values to defaults
    setCategory('T-SHIRT R/N');
    setDesigner(designersList[0] || 'Admin');
    setFabricType('Cotton Blend');
    setTargetSizes(['M']);
    setColorCode('#3b82f6');
    setQuantity(100);
    setLotNo('');
    setLotNo2('');
    setBrand('');
    setStyle('');
    setSection('Men');
    setSeason('Summer');
    setBomItems(createDefaultBomItems(accessoriesList, materials));
  };

  const handleEditDraft = (design) => {
    setEditingDesignId(design.id);
    setCategory(design.category);
    setDesigner(design.designer || 'Admin');
    setFabricType(design.fabricType);
    setTargetSizes(design.targetSizes ? design.targetSizes.split(',').map(s => s.trim()) : ['M']);
    setColorCode(design.colorCode);
    setQuantity(design.quantity || 100);
    setLotNo(design.id);
    setLotNo2(design.lotNo2 === 'N/A' ? '' : design.lotNo2);
    setBrand(design.brand === 'Custom Brand' ? '' : design.brand);
    setStyle(design.style === 'ST-DEFAULT' ? '' : design.style);
    setSection(design.section);
    setSeason(design.season);
    setBomItems(design.bom || []);
    setImageUrl(design.imageUrl || '');
    setFormImageError(false);
    setIsCreating(true);
  };

  const handleAddInlineAccessory = (e) => {
    e.preventDefault();
    if (!newInlineName.trim()) return;
    const name = newInlineName.trim();
    const exists = bomItems.some(b => b.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setAccessoryError('This accessory already exists.');
      return;
    }
    setAccessoryError('');
    const newItem = { name, status: 'Yes', detail: '1', description: `${name} required`, materialId: '' };
    newItem.materialId = findMatchingMaterialId(newItem, materials);
    setBomItems([...bomItems, newItem]);
    setNewInlineName('');
    setShowAddInline(false);
  };

  const handleDeleteBOMItem = (index) => {
    setBomItems(bomItems.filter((_, idx) => idx !== index));
  };

  const handleSizeToggle = (size) => {
    if (targetSizes.includes(size)) {
      setTargetSizes(targetSizes.filter(s => s !== size));
    } else {
      setTargetSizes([...targetSizes, size]);
    }
  };

  const handleBomChange = (index, field, value) => {
    const newItems = [...bomItems];
    if (field === 'status') {
      newItems[index].status = value;
      if (value === 'No') {
        newItems[index].detail = '';
        newItems[index].description = '';
        newItems[index].materialId = '';
      } else if (value === 'Yes') {
        if (!newItems[index].detail) newItems[index].detail = '1';
        if (!newItems[index].description) newItems[index].description = `${newItems[index].name} required`;
        newItems[index].materialId = findMatchingMaterialId(newItems[index], materials);
      }
    } else if (field === 'detail') {
      newItems[index][field] = value.replace(/\D/g, '');
      newItems[index].materialId = findMatchingMaterialId(newItems[index], materials);
    } else {
      newItems[index][field] = value;
      newItems[index].materialId = findMatchingMaterialId(newItems[index], materials);
    }

    setBomItems(newItems);
  };

  const selectedDesign = designs.find(d => d.id === selectedDesignId) || sortedDesigns[0];
  const printableDesign = printingDesign || selectedDesign || sortedDesigns[0];


  // Debounced auto-fetch for Lot No
  useEffect(() => {
    if (!isCreating || editingDesignId) return;
    const trimmed = lotNo.trim();
    if (!trimmed || trimmed.length < 3) return;

    const delayDebounceFn = setTimeout(() => {
      handleFetchLotData(trimmed, false);
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [lotNo, isCreating, editingDesignId]);

  const handleFetchLotData = async (overrideLot, isManual = false) => {
    const targetLot = (typeof overrideLot === 'string' ? overrideLot : lotNo).trim();
    if (!targetLot) return;
    if (!isManual && targetLot === lastFetchedLotNo) return;

    setIsFetching(true);
    setFetchMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${getBackendUrl()}/api/lot/${targetLot}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch lot data');
      }

      setLastFetchedLotNo(targetLot);

      // Successfully fetched data! Update state fields
      if (data.brand) setBrand(data.brand);
      if (data.style) setStyle(data.style);
      if (data.fabric) setFabricType(data.fabric);
      if (data.quantity) setQuantity(Number(data.quantity) || 100);

      setImageUrl(data.imageUrl || '');
      setFormImageError(false);

      // Standardize/Match Garment Category
      if (data.garmentType) {
        const typeNormalized = data.garmentType.trim().toUpperCase();
        const matchedCategory = GARMENT_CATEGORIES.find(cat =>
          cat === typeNormalized || cat.includes(typeNormalized) || typeNormalized.includes(cat)
        );
        if (matchedCategory) {
          setCategory(matchedCategory);
        } else if (data.garmentType.trim()) {
          setCategory(data.garmentType.trim());
        }
      }

      // Standardize/Match Section
      if (data.section) {
        const secLower = data.section.trim().toLowerCase();
        if (secLower.includes('gents') || secLower.includes('men') || secLower.includes('man')) {
          setSection('Men');
        } else if (secLower.includes('ladies') || secLower.includes('women') || secLower.includes('woman')) {
          setSection('Women');
        } else if (secLower.includes('kids') || secLower.includes('kid')) {
          setSection('Kids');
        } else if (secLower.includes('boys')) {
          setSection('Boys');
        } else if (secLower.includes('girls')) {
          setSection('Girls');
        } else if (secLower.includes('infant')) {
          setSection('Infant');
        } else {
          setSection('Unisex');
        }
      }

      // Standardize/Match Season
      if (data.season) {
        const seasLower = data.season.trim().toLowerCase();
        if (seasLower.includes('winter')) {
          setSeason('Winter');
        } else if (seasLower.includes('summer')) {
          setSeason('Summer');
        }
      }

      // Accessories matching
      if (data.tapeLace) setTapeLace(data.tapeLace);
      if (data.bottomType) setBottomType(data.bottomType);
      if (data.zip) setZip(data.zip);
      if (data.sticker) setSticker(data.sticker);
      if (data.collar) setCollar(data.collar);
      if (data.bone) setBone(data.bone);
      if (data.fullBaju) setFullBaju(data.fullBaju);

      // Parse sizes (e.g. "M, L, L, XL, XXL" or "M/L/L/XL/XXL")
      if (data.size) {
        const sizeDelim = data.size.includes('/') ? '/' : ',';
        const parsedSizes = data.size
          .split(sizeDelim)
          .map(s => s.trim().toUpperCase())
          .filter((s, idx, self) => s && self.indexOf(s) === idx);

        const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
        const matchedSizes = parsedSizes.filter(s => validSizes.includes(s));
        if (matchedSizes.length > 0) {
          setTargetSizes(matchedSizes);
        }
      }

      // Auto-populate checklist accessories strictly from fetched Google Sheet data
      const baseChecklist = (accessoriesList && accessoriesList.length > 0) ? accessoriesList : [
        'Zip', 'Button', 'Elastic', 'Tape / Lace', 'Rib', 'Collar',
        'Sticker / Label', 'Thread', 'Pocket', 'Drawstring / Nara',
        'Hook, buckle, velcro', 'Interlining / fusing', 'Bone', 'Full Baju'
      ];
      const uniqueNames = [...new Set(baseChecklist)];

      const updatedBom = uniqueNames.map(name => {
        const sheetVal = getAccessorySheetValue(name, data);
        const isYes = isSheetValueYes(sheetVal);
        const norm = name.toLowerCase();

        let detail = '';
        let description = '';

        if (isYes) {
          if (norm.includes('elastic') || norm.includes('rib')) {
            detail = extractInteger(sheetVal);
          } else {
            detail = '1';
          }
          description = getSheetDescription(sheetVal, `${name} required`);
        }

        const item = {
          name,
          status: isYes ? 'Yes' : 'No',
          detail,
          description,
          materialId: ''
        };

        if (isYes) {
          item.materialId = findMatchingMaterialId(item, materials);
        }
        return item;
      });

      setBomItems(updatedBom);

      // Set overridden Lot No to the fetched lot number
      setLotNo(data.lotNo);

      setFetchMessage({
        type: 'success',
        text: `Specs for Lot #${data.lotNo} loaded successfully! (${data.brand} — ${data.garmentType})`
      });

    } catch (err) {
      console.error(err);
      setFetchMessage({
        type: 'error',
        text: err.message || 'Failed to fetch lot details.'
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Auto-increment Lot Number (Design ID) starting at 11000 — Lot No IS the name
    const nextId = getNextLotNo();
    const finalId = (lotNo.trim() || editingDesignId || String(nextId)).trim();

    const getBOMAccessoryStatus = (name) => {
      const item = bomItems.find(b => b.name.toLowerCase() === name.toLowerCase());
      return item ? item.status : 'No';
    };
    const getBOMAccessoryDetail = (name) => {
      const item = bomItems.find(b => b.name.toLowerCase() === name.toLowerCase());
      return item ? item.detail : '';
    };

    const newDesign = {
      id: finalId,
      isEdit: !!editingDesignId,
      name: finalId, // Lot No serves as primary identifier / name
      lotNo2: lotNo2.trim() || 'N/A',
      brand: brand.trim() || 'Custom Brand',
      category,
      designer,
      fabricType,
      targetSizes: targetSizes.join(', '),
      colorCode,
      status: submitStatus,
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      section,
      season,
      style: style.trim() || 'ST-DEFAULT',
      tapeLace: getBOMAccessoryStatus('Tape / Lace'),
      bottomType: getBOMAccessoryDetail('Elastic') || getBOMAccessoryDetail('Rib') || 'N/A',
      zip: getBOMAccessoryStatus('Zip'),
      sticker: getBOMAccessoryStatus('Sticker / Label'),
      collar: getBOMAccessoryStatus('Collar'),
      bone: getBOMAccessoryStatus('Bone'),
      fullBaju: getBOMAccessoryStatus('Full Baju'),
      bom: bomItems,
      totalCost: 0,
      imageUrl: getCleanImageUrl(imageUrl.trim()),
      quantity: Number(quantity) || 100
    };

    onAddDesign(newDesign);
    setSelectedDesignId(newDesign.id);
    setPrintingDesign(newDesign);

    // Reset state
    setEditingDesignId(null);
    setCategory('T-SHIRT R/N');
    setFabricType('Cotton Blend');
    setTargetSizes(['M']);
    setColorCode('#3b82f6');
    setQuantity(100);
    setLotNo('');
    setLotNo2('');
    setBrand('');
    setStyle('');
    setSection('Men');
    setSeason('Summer');
    setTapeLace('No');
    setBottomType('N/A');
    setZip('No');
    setSticker('No');
    setCollar('No');
    setBone('No');
    setFullBaju('No');
    setBomItems(createDefaultBomItems(accessoriesList, materials));
    setImageUrl('');
    setLastFetchedLotNo('');
    setIsCreating(false);

    // Automatically trigger printing of the new Tech Pack if NOT a draft
    if (submitStatus !== 'Draft') {
      setTimeout(() => {
        document.body.classList.add('print-techpack-mode');
        window.print();
      }, 150);
    }
  };

  return (
    <div className="animate-fade">
      {/* Title Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '22px', fontWeight: '700', margin: 0 }}>Garment Design</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onRedirectToTab ? onRedirectToTab('only_cutting') : (window.location.href = '/only-cutting')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Scissors size={15} />
            <span>Only Cutting</span>
          </button>
          {!isCreating && (
            <button className="btn btn-primary" onClick={handleStartCreating}>
              <PlusCircle size={16} />
              <span>Create Design Request</span>
            </button>
          )}
        </div>
      </div>

      {isCreating ? (
        /* Create New Design View */
        <div className="panel animate-scale">
          <div className="panel-header">
            <h3 className="panel-title">New Garment Design</h3>
            <button className="btn btn-secondary btn-sm" onClick={handleCancelCreating}>Cancel</button>
          </div>

          {/* Auto Lot No Preview Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            backgroundColor: 'var(--accent-light)',
            border: '1.5px solid var(--accent-color)',
            borderRadius: 'var(--border-radius-md)',
            padding: '14px 20px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Auto-Generated Lot No</span>
              <span style={{ fontFamily: 'var(--font-family-title)', fontSize: '28px', fontWeight: '800', color: 'var(--accent-color)', lineHeight: 1.2 }}>{getNextLotNo()}</span>
            </div>
            <div style={{ borderLeft: '1px solid var(--accent-color)', paddingLeft: '16px', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="form-label" style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: 'bold', marginBottom: '2px' }}>Lot Number</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter Lot No (e.g. 11028)"
                  value={lotNo}
                  onChange={(e) => setLotNo(e.target.value)}
                  style={{ height: '38px', fontSize: '14px', flexGrow: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleFetchLotData(undefined, true)}
                  disabled={isFetching}
                  style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px', height: '38px', whiteSpace: 'nowrap' }}
                >
                  <Database size={14} />
                  {isFetching ? 'Fetching...' : 'Fetch Sheet'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onRedirectToTab ? onRedirectToTab('only_cutting') : (window.location.href = '/only-cutting')}
                  title="Browse Undesigned Cutting Lots"
                  style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', height: '38px', whiteSpace: 'nowrap' }}
                >
                  <Scissors size={14} />
                  <span>Browse Lots</span>
                </button>
              </div>
            </div>
          </div>

          {/* Fetch feedback messages */}
          {fetchMessage.text && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--border-radius-sm)',
              marginBottom: '20px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: fetchMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
              border: fetchMessage.type === 'success' ? '1px solid #10b981' : '1px solid #ef4444',
              color: fetchMessage.type === 'success' ? '#065f46' : '#991b1b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>{fetchMessage.text}</span>
              <button
                type="button"
                onClick={() => setFetchMessage({ type: '', text: '' })}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
          )}

          {imageUrl && (
            <div style={{
              marginBottom: '20px',
              borderRadius: 'var(--border-radius-md)',
              border: '1.5px solid var(--border-color)',
              overflow: 'hidden',
              backgroundColor: '#f8fafc',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ImageIcon size={14} className="text-accent" />
                  Garment Visual Preview
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {imageUrl.startsWith('http') && (
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px', height: 'auto', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ExternalLink size={11} />
                      <span>Original Link</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => { setImageUrl(''); setFormImageError(false); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', padding: '2px 6px' }}
                    title="Remove Visual"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div style={{
                width: '100%',
                height: '190px',
                borderRadius: 'var(--border-radius-sm)',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                position: 'relative'
              }}>
                {!formImageError ? (
                  <img
                    src={getCleanImageUrl(imageUrl)}
                    alt="Garment Design Preview"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                    onError={() => setFormImageError(true)}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                    <ImageOff size={24} />
                    <span style={{ fontSize: '12px', fontWeight: '500' }}>Could not render inline preview</span>
                    <a href={imageUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: 'bold' }}>
                      Click to open image in new tab ↗
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Lot No 2 (Secondary Lot / Dye Batch)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. LOT-MH-B"
                  value={lotNo2}
                  onChange={(e) => setLotNo2(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Brand / Client Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Zara, Nike, Adidas, custom"
                  value={brand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Garment Category</label>
                <select
                  className="form-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {GARMENT_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Style Code / Reference No</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ST-9921, TS-2201"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Primary Fabric Type</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 100% Organic Cotton"
                  value={fabricType}
                  onChange={(e) => setFabricType(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Designer In-charge</label>
                <input
                  type="text"
                  list="designer-suggestions"
                  className="form-input"
                  placeholder="e.g. Admin or enter designer name"
                  value={designer}
                  onChange={(e) => setDesigner(e.target.value)}
                />
                <datalist id="designer-suggestions">
                  <option value="Admin" />
                  {designersList
                    .filter(name => !['sarah connor', 'michael scott'].includes(name.toLowerCase()))
                    .map(name => (
                      <option key={name} value={name} />
                    ))}
                </datalist>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Garment Section / Target Audience</label>
                <select
                  className="form-input"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                >
                  <option value="Men">Men</option>
                  <option value="Women">Women</option>
                  <option value="Kids">Kids</option>
                  <option value="Boys">Boys</option>
                  <option value="Girls">Girls</option>
                  <option value="Infant">Infant</option>
                  <option value="Unisex">Unisex</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Season Campaign</label>
                <select
                  className="form-input"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                >
                  <option value="Summer">Summer</option>
                  <option value="Winter">Winter</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Target Size Specifications</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((sz) => (
                  <button
                    type="button"
                    key={sz}
                    onClick={() => handleSizeToggle(sz)}
                    className={`btn btn-sm ${targetSizes.includes(sz) ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', borderRadius: '4px' }}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Primary Colorway Swatch</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="color"
                    className="form-input"
                    style={{ width: '60px', height: '40px', padding: '2px', cursor: 'pointer' }}
                    value={colorCode}
                    onChange={(e) => setColorCode(e.target.value)}
                  />
                  <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>{colorCode.toUpperCase()}</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Order Quantity (Pieces)</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  placeholder="e.g. 500"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 100)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Design Image URL (Auto-fetched or Manual)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Google Drive link or direct image link"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Bill of Materials (BOM) Section */}
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h4 style={{ fontFamily: 'var(--font-family-title)', fontSize: '16px', fontWeight: '600' }}>Garment Accessories (BOM) Specifications</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Configure specifications and requirement status for garment accessories.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddInline(!showAddInline)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <PlusCircle size={14} />
                  <span>{showAddInline ? 'Close Form' : 'Add Custom Accessory'}</span>
                </button>
              </div>

              {showAddInline && (
                <div
                  className="animate-scale"
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'var(--accent-light)',
                    border: '1.5px solid var(--accent-color)',
                    borderRadius: 'var(--border-radius-md)',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter name of new custom accessory (one-time for this design)..."
                      value={newInlineName}
                      onChange={(e) => {
                        setNewInlineName(e.target.value);
                        if (accessoryError) setAccessoryError('');
                      }}
                      style={{ flexGrow: 1, height: '36px', fontSize: '13px' }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleAddInlineAccessory}
                      style={{ height: '36px' }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setShowAddInline(false); setNewInlineName(''); setAccessoryError(''); }}
                      style={{ height: '36px' }}
                    >
                      Cancel
                    </button>
                  </div>
                  {accessoryError && (
                    <div style={{ color: 'var(--danger-color, #f43e5c)', fontSize: '12px', fontWeight: '600', marginTop: '8px', textAlign: 'left', width: '100%' }}>
                      {accessoryError}
                    </div>
                  )}
                </div>
              )}

              {/* Headers for Accessories builder */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 2fr 3fr 0.5fr',
                gap: '16px',
                marginBottom: '12px',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <span>Accessory Name</span>
                <span style={{ textAlign: 'center' }}>Required / Status</span>
                <span>Qty/Piece</span>
                <span>Description</span>
                <span style={{ textAlign: 'right' }}>Remove</span>
              </div>

              {bomItems.map((bomRow, index) => (
                <div key={index} className="bom-builder-row animate-fade" style={{ gridTemplateColumns: '2fr 1.5fr 2fr 3fr 0.5fr', gap: '16px', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bomRow.name}
                  </div>
                  <div>
                    <select
                      className="form-input"
                      value={bomRow.status || 'No'}
                      onChange={(e) => handleBomChange(index, 'status', e.target.value)}
                      style={{ textAlign: 'center' }}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="form-input"
                      placeholder={`Qty...`}
                      value={bomRow.detail || ''}
                      onChange={(e) => handleBomChange(index, 'detail', e.target.value)}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={`Enter description for ${bomRow.name.toLowerCase()}...`}
                      value={bomRow.description || ''}
                      onChange={(e) => handleBomChange(index, 'description', e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteBOMItem(index)}
                      className="btn btn-danger btn-sm"
                      style={{
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: 'var(--danger)'
                      }}
                      title={`Remove ${bomRow.name} from checklist`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancelCreating}>Cancel</button>
              <button type="submit" className="btn btn-secondary" style={{ borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }} onClick={() => setSubmitStatus('Draft')}>Draft Design</button>
              <button type="submit" className="btn btn-primary" onClick={() => setSubmitStatus('In Verification')}>Confirm Design</button>
            </div>
          </form>
        </div>
      ) : (
        /* Standard Split View: Designs List & Tech Pack BOM details */
        <div className="split-view">
          {/* Left Side: Search and Designs Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Search, Sort and Filter Inputs bar */}
            <div style={{ display: 'flex', gap: '8px', position: 'relative', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ position: 'relative', flex: '1 1 200px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by Lot No, Brand, Style code, Category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px', height: '38px', fontSize: '13.5px' }}
                />
              </div>

              {/* Status Filter */}
              <div style={{ width: '130px' }}>
                <select
                  className="form-input"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ height: '38px', fontSize: '13.5px', padding: '0 8px', cursor: 'pointer' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="In Verification">In Verification</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>

              {/* Sort Order */}
              <div style={{ width: '130px' }}>
                <select
                  className="form-input"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ height: '38px', fontSize: '13.5px', padding: '0 8px', cursor: 'pointer' }}
                >
                  <option value="latest">Latest Design</option>
                  <option value="lotNoDesc">Lot No: High-Low</option>
                  <option value="lotNoAsc">Lot No: Low-High</option>
                </select>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                  setSortBy('latest');
                }}
                disabled={!searchQuery && filterStatus === 'all' && sortBy === 'latest'}
                style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Clear
              </button>
            </div>

            <div className="design-grid" style={{ flexGrow: 1, alignContent: 'start' }}>
              {filteredDesigns.length > 0 ? (
                filteredDesigns.map((design) => (
                  <div
                    key={design.id}
                    className={`design-card cursor-pointer ${selectedDesignId === design.id ? 'active' : ''}`}
                    style={{ border: selectedDesignId === design.id ? '2px solid var(--accent-color)' : '1px solid var(--border-color)' }}
                    onClick={() => setSelectedDesignId(design.id)}
                  >
                    <div className="design-card-preview">
                      {design.imageUrl ? (
                        <img
                          src={getCleanImageUrl(design.imageUrl)}
                          alt={design.name}
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <GarmentSketch category={design.category} color={design.colorCode} />
                      )}
                      {/* Lot No badge overlay on sketch */}
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        backgroundColor: 'var(--accent-color)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        fontFamily: 'var(--font-family-title)',
                        letterSpacing: '0.04em'
                      }}>
                        #{getLotVersionInfo(design.id, designs).displayLot}
                      </div>
                      <span
                        className={`status-badge ${design.status.toLowerCase().replace(/\s+/g, '-')}`}
                        style={{ position: 'absolute', top: '10px', right: '10px' }}
                      >
                        {design.status}
                      </span>
                    </div>
                    <div className="design-card-info">
                      <h3 className="design-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', fontFamily: 'monospace' }}>LOT</span>
                            <span style={{ fontWeight: 'bold' }}>{getLotVersionInfo(design.id, designs).displayLot}</span>
                          </div>
                        </div>
                        {design.style && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              fontWeight: 'normal',
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={design.style}
                          >
                            {design.style}
                          </span>
                        )}
                      </h3>
                      <div className="design-card-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Tag size={12} /> {design.category}
                        </span>
                        {design.brand && <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-color)' }}>{design.brand}</span>}
                      </div>
                      {design.created_at && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontWeight: '600', color: 'var(--accent-color)' }}>Created:</span>
                          <span style={{ fontWeight: '500' }}>{formatDesignTime(design.created_at)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>{design.lotNo2 && design.lotNo2 !== 'N/A' ? `Lot 2: ${design.lotNo2}` : ''}</span>
                        {design.totalCost > 0 && (
                          <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>
                            Cost: {currencySymbol}{design.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px', gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No designs found matching search criteria.
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Selected Design BOM Technical Pack */}
          {selectedDesign && (
            <>
              {/* 1. INTERACTIVE SCREEN-ONLY VERSION */}
              <div className="panel animate-scale techspec-panel screen-only-element">
                <div className="panel-header">
                  <h3 className="panel-title">
                    <Layers3 size={18} className="text-accent" />
                    Fashion Customization
                  </h3>
                  {/* Prominent Lot No badge & Print action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {selectedDesign.status !== 'Approved' && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm print-hide"
                        onClick={() => handleEditDraft(selectedDesign)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>Edit Design</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm print-hide"
                      onClick={() => {
                        setPrintingDesign(selectedDesign);
                        document.body.classList.add('print-techpack-mode');
                        window.print();
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Printer size={14} />
                      <span>Print PDF</span>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>LOT NO</span>
                      <span style={{
                        fontFamily: 'var(--font-family-title)',
                        fontSize: '20px',
                        fontWeight: '800',
                        color: 'var(--accent-color)',
                        letterSpacing: '0.04em'
                      }}>{selectedDesign.id}</span>
                    </div>
                  </div>
                </div>

                {selectedDesign.imageUrl && (
                  <div
                    style={{
                      marginBottom: '24px',
                      borderRadius: 'var(--border-radius-md)',
                      border: '1.5px solid var(--border-color)',
                      overflow: 'hidden',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: '320px',
                      width: '100%',
                      padding: '12px',
                      position: 'relative'
                    }}
                    className="design-image-container animate-fade"
                  >
                    {/* Fetching or Loading Spinner Overlay */}
                    {(isFetching || (isImageLoading && !imageError)) && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(248, 250, 252, 0.95)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '12px',
                        zIndex: 10
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: '3px solid var(--accent-light)',
                          borderTopColor: 'var(--accent-color)',
                          animation: 'spin 1s linear infinite'
                        }}></div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                          {isFetching ? 'Syncing Lot Specs...' : 'Loading Design Visual...'}
                        </span>
                      </div>
                    )}

                    {/* Standard Image Tag */}
                    {!imageError ? (
                      <img
                        src={getCleanImageUrl(selectedDesign.imageUrl)}
                        alt={`Lot ${selectedDesign.id} design visual`}
                        style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                        onLoad={() => setIsImageLoading(false)}
                        onError={() => {
                          setImageError(true);
                          setIsImageLoading(false);
                        }}
                      />
                    ) : (
                      /* Fallback to premium vector sketch if image fails to load */
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <GarmentSketch category={selectedDesign.category} color={selectedDesign.colorCode} />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No design preview available</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Garment Details Grid */}
                <div className="spec-list">
                  <div className="spec-item" style={{ backgroundColor: 'var(--accent-light)', borderRadius: '6px', padding: '8px 12px', border: '1px solid var(--accent-color)', gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span className="spec-label" style={{ color: 'var(--accent-color)', fontWeight: '700' }}>Lot Number</span>
                      <span className="spec-value" style={{ color: 'var(--accent-color)', fontSize: '16px', fontWeight: '800', fontFamily: 'var(--font-family-title)' }}>{selectedDesign.id}</span>
                    </div>
                    {selectedDesign.repeat_against && (
                      <span className="status-badge in-verification" style={{ fontSize: '10px', padding: '4px 8px', textTransform: 'none', fontWeight: 'bold', display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                        🔁 Repeat against #{selectedDesign.repeat_against}
                      </span>
                    )}
                  </div>
                  {selectedDesign.lotNo2 && selectedDesign.lotNo2 !== 'N/A' && (
                    <div className="spec-item">
                      <span className="spec-label">Secondary Lot No</span>
                      <span className="spec-value" style={{ fontWeight: 'bold' }}>{selectedDesign.lotNo2}</span>
                    </div>
                  )}
                  {selectedDesign.repeat_against && (
                    <div className="spec-item" style={{ gridColumn: 'span 2', background: 'linear-gradient(90deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))', borderRadius: '10px', border: '1.5px solid rgba(245,158,11,0.4)', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="spec-label" style={{ color: '#b45309', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🔄 REPEAT LOT
                      </span>
                      <span className="spec-value" style={{ fontWeight: '900', color: '#b45309', fontSize: '16px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#92400e', background: 'rgba(245,158,11,0.15)', borderRadius: '4px', padding: '1px 6px' }}>Repeat Against</span>
                        Lot #{selectedDesign.repeat_against}
                      </span>
                    </div>
                  )}
                  {selectedDesign.brand && (
                    <div className="spec-item">
                      <span className="spec-label">Brand / Client</span>
                      <span className="spec-value" style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{selectedDesign.brand}</span>
                    </div>
                  )}
                  {selectedDesign.style && (
                    <div className="spec-item">
                      <span className="spec-label">Style Code</span>
                      <span className="spec-value" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{selectedDesign.style}</span>
                    </div>
                  )}
                  {selectedDesign.section && (
                    <div className="spec-item">
                      <span className="spec-label">Section</span>
                      <span className="spec-value">{selectedDesign.section}</span>
                    </div>
                  )}
                  {selectedDesign.season && (
                    <div className="spec-item">
                      <span className="spec-label">Season</span>
                      <span className="spec-value">{selectedDesign.season}</span>
                    </div>
                  )}
                  <div className="spec-item">
                    <span className="spec-label">Designer</span>
                    <span className="spec-value">{selectedDesign.designer}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Category</span>
                    <span className="spec-value">{selectedDesign.category}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Primary Fabric</span>
                    <span className="spec-value">{selectedDesign.fabricType}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Sizes Configured</span>
                    <span className="spec-value" style={{ letterSpacing: '1px' }}>{selectedDesign.targetSizes}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Status</span>
                    <span className={`status-badge ${selectedDesign.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {selectedDesign.status}
                    </span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Label</span>
                    <span className="spec-value" style={{
                      fontWeight: '600',
                      color: selectedDesign.bom?.find(b => b.name.toLowerCase() === 'label')?.status === 'Yes' ? 'var(--accent-color)' : 'var(--text-muted)'
                    }}>{selectedDesign.bom?.find(b => b.name.toLowerCase() === 'label')?.status || 'Yes'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Tag</span>
                    <span className="spec-value" style={{
                      fontWeight: '600',
                      color: selectedDesign.bom?.find(b => b.name.toLowerCase() === 'tag')?.status === 'Yes' ? 'var(--accent-color)' : 'var(--text-muted)'
                    }}>{selectedDesign.bom?.find(b => b.name.toLowerCase() === 'tag')?.status || 'Yes'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Dori / Drawstring</span>
                    <span className="spec-value" style={{
                      fontWeight: '600',
                      color: (selectedDesign.bom?.find(b => b.name.toLowerCase().includes('dori'))?.status === 'Yes' || selectedDesign.bom?.find(b => b.name.toLowerCase().includes('drawstring'))?.status === 'Yes') ? 'var(--accent-color)' : 'var(--text-muted)'
                    }}>{selectedDesign.bom?.find(b => b.name.toLowerCase().includes('dori'))?.status || selectedDesign.bom?.find(b => b.name.toLowerCase().includes('drawstring'))?.status || 'Yes'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Tape/Lace</span>
                    <span className="spec-value" style={{
                      fontWeight: '600',
                      color: !selectedDesign.tapeLace || selectedDesign.tapeLace.toLowerCase() === 'no' ? 'var(--text-muted)' : 'var(--accent-color)'
                    }}>{selectedDesign.tapeLace || 'No'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Bottom Type</span>
                    <span className="spec-value">{selectedDesign.bottomType || 'N/A'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Zip Requirement</span>
                    <span className="spec-value" style={{
                      fontWeight: '600',
                      color: !selectedDesign.zip || selectedDesign.zip.toLowerCase() === 'no' ? 'var(--text-muted)' : 'var(--accent-color)'
                    }}>{selectedDesign.zip || 'No'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Sticker</span>
                    <span className="spec-value" style={{
                      fontWeight: '600',
                      color: !selectedDesign.sticker || selectedDesign.sticker.toLowerCase() === 'no' ? 'var(--text-muted)' : 'var(--accent-color)'
                    }}>{selectedDesign.sticker || 'No'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Collar</span>
                    <span className="spec-value" style={{
                      fontWeight: '600',
                      color: !selectedDesign.collar || selectedDesign.collar.toLowerCase() === 'no' ? 'var(--text-muted)' : 'var(--accent-color)'
                    }}>{selectedDesign.collar || 'No'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Bone</span>
                    <span className="spec-value" style={{
                      fontWeight: '600',
                      color: !selectedDesign.bone || selectedDesign.bone.toLowerCase() === 'no' ? 'var(--text-muted)' : 'var(--accent-color)'
                    }}>{selectedDesign.bone || 'No'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Full Baju</span>
                    <span className="spec-value" style={{
                      fontWeight: '600',
                      color: !selectedDesign.fullBaju || selectedDesign.fullBaju.toLowerCase() === 'no' ? 'var(--text-muted)' : 'var(--accent-color)'
                    }}>{selectedDesign.fullBaju || 'No'}</span>
                  </div>
                  <div className="spec-item">
                    <span className="spec-label">Date Created</span>
                    <span className="spec-value">{selectedDesign.date}</span>
                  </div>
                </div>

                {/* BOM Table */}
                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ fontFamily: 'var(--font-family-title)', fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>
                    Garment Accessories BOM
                  </h4>
                  <div className="custom-table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Accessory Name</th>
                          <th style={{ textAlign: 'center' }}>Required status</th>
                          <th>Qty/Piece</th>
                          <th>Description</th>
                          <th>Inventory Item Map</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDesign.bom && selectedDesign.bom.map((item, idx) => {
                          const matchedMat = materials.find(m => m.id === item.materialId);
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: '600' }}>{item.name}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`status-badge ${String(item.status).toLowerCase() === 'yes' ? 'verified' : 'rejected'}`}>
                                  {item.status}
                                </span>
                              </td>
                              <td>{item.detail || '—'}</td>
                              <td>{item.description || '—'}</td>
                              <td>
                                {matchedMat ? (
                                  <span className="status-badge verified" style={{ fontSize: '12px' }}>
                                    {matchedMat.name} {matchedMat.color && matchedMat.color !== 'Default' && `— ${matchedMat.color}`} ({matchedMat.id})
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>Unmapped</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. PRINT-ONLY LAYOUT (Always rendered at root level so print view never breaks) */}
      {printableDesign && (
        <div className="print-layout-container print-only-element">
          <div className="print-header">
            <h2>Fashion Customization</h2>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <div className="lot-badge">LOT NO: {printableDesign.id}</div>
              {printableDesign.repeat_against && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(90deg, #fef3c7, #fde68a)', border: '1.5px solid #f59e0b', borderRadius: '6px', padding: '4px 12px' }}>
                  <span style={{ fontSize: '13px' }}>🔄</span>
                  <span style={{ fontWeight: '900', fontSize: '10px', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Repeat Against Lot</span>
                  <span style={{ fontWeight: '900', fontSize: '14px', color: '#b45309', letterSpacing: '1px' }}>#{printableDesign.repeat_against}</span>
                </div>
              )}
            </div>
          </div>

          <div className="print-columns">
            {/* Left Column: Image */}
            <div className="print-image-col">
              {printableDesign.imageUrl ? (
                <img
                  src={getCleanImageUrl(printableDesign.imageUrl)}
                  alt={`Lot ${printableDesign.id} design visual`}
                />
              ) : (
                <GarmentSketch category={printableDesign.category} color={printableDesign.colorCode} />
              )}
            </div>

            {/* Right Column: Accessories Detail */}
            <div className="print-accessories-col">
              <h3>Accessories Detail</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {printableDesign.bom && printableDesign.bom.filter(item => String(item.status).toLowerCase() === 'yes').map((item, idx) => {
                  const matchedMat = materials.find(m => m.id === item.materialId);
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #cccccc', paddingBottom: '4px', fontSize: '13px' }}>
                      <span style={{ fontWeight: '700' }}>
                        {item.name} {item.detail && `(Qty: ${item.detail})`}
                        {matchedMat && <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: '6px' }}>[Map: {matchedMat.name} {matchedMat.color && matchedMat.color !== 'Default' && `(${matchedMat.color})`}]</span>}
                      </span>
                      <span style={{ color: '#333333', fontWeight: '500' }}>{item.description || 'Required'}</span>
                    </div>
                  );
                })}
                {(!printableDesign.bom || printableDesign.bom.filter(item => String(item.status).toLowerCase() === 'yes').length === 0) && (
                  <div style={{ color: '#888888', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
                    No accessories required
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Details Section */}
          <div className="print-details-section">
            <div className="print-details-grid">
              <div className="print-detail-item">
                <span className="print-detail-label">Lot no</span>
                <span className="print-detail-value">{printableDesign.id}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Secondary Lot</span>
                <span className="print-detail-value">{printableDesign.lotNo2 || '—'}</span>
              </div>

              <div className="print-detail-item">
                <span className="print-detail-label">Brand</span>
                <span className="print-detail-value">{printableDesign.brand || '—'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Style</span>
                <span className="print-detail-value">{printableDesign.style || '—'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Section</span>
                <span className="print-detail-value">{printableDesign.section || '—'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Season</span>
                <span className="print-detail-value">{printableDesign.season || '—'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Designer</span>
                <span className="print-detail-value">{printableDesign.designer || '—'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Category</span>
                <span className="print-detail-value">{printableDesign.category || '—'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Primary Fabric</span>
                <span className="print-detail-value">{printableDesign.fabricType || '—'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Sizes</span>
                <span className="print-detail-value">{printableDesign.targetSizes || '—'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Status</span>
                <span className="print-detail-value">{printableDesign.status || '—'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Label</span>
                <span className="print-detail-value">{printableDesign.bom?.find(b => b.name.toLowerCase() === 'label')?.status || 'Yes'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Tag</span>
                <span className="print-detail-value">{printableDesign.bom?.find(b => b.name.toLowerCase() === 'tag')?.status || 'Yes'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Dori</span>
                <span className="print-detail-value">{printableDesign.bom?.find(b => b.name.toLowerCase().includes('dori'))?.status || printableDesign.bom?.find(b => b.name.toLowerCase().includes('drawstring'))?.status || 'Yes'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Tape / Lace</span>
                <span className="print-detail-value">{printableDesign.tapeLace || 'No'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Bottom Type</span>
                <span className="print-detail-value">{printableDesign.bottomType || '—'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Zip</span>
                <span className="print-detail-value">{printableDesign.zip || 'No'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Sticker</span>
                <span className="print-detail-value">{printableDesign.sticker || 'No'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Button</span>
                <span className="print-detail-value">{printableDesign.bom?.find(b => b.name.toLowerCase() === 'button')?.status || 'No'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Collar</span>
                <span className="print-detail-value">{printableDesign.collar || 'No'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Bone</span>
                <span className="print-detail-value">{printableDesign.bone || 'No'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Full Baju</span>
                <span className="print-detail-value">{printableDesign.fullBaju || 'No'}</span>
              </div>
              <div className="print-detail-item">
                <span className="print-detail-label">Date Created</span>
                <span className="print-detail-value">{printableDesign.date || '—'}</span>
              </div>
            </div>
          </div>

          {/* Signatures Section */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '55px',
            padding: '0 20px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: '220px' }}>
              <div style={{ borderBottom: '1.5px solid #000000', height: '40px' }}></div>
              <span style={{ fontWeight: '700', textAlign: 'center', marginTop: '6px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em', color: '#000000' }}>Designer Sign</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', width: '220px' }}>
              <div style={{ borderBottom: '1.5px solid #000000', height: '40px' }}></div>
              <span style={{ fontWeight: '700', textAlign: 'center', marginTop: '6px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em', color: '#000000' }}>Authority Sign</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const getLotVersionInfo = (lotNo, designs = []) => {
  const lotStr = String(lotNo || '').trim();
  const d = designs.find(des => String(des.id).toLowerCase() === lotStr.toLowerCase());
  if (d && d.repeat_against) {
    return {
      displayLot: lotStr,
      versionText: `Repeat against Lot #${d.repeat_against}`,
      isRecreated: true
    };
  }
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
    versionText: 'Original Lot',
    isRecreated: false
  };
};
