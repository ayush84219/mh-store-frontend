import { getBackendUrl } from './utils/api';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Layers3, CheckSquare, FileText,
  Layers, BarChart3, Settings as SettingsIcon, Sun, Moon,
  CheckCircle, AlertTriangle, Scissors,
  LogOut, X, ClipboardList, Shield, RotateCcw, ShieldCheck,
  History, Bell, QrCode, Truck, Download, ChevronDown, ChevronRight, ArrowLeftRight, Menu,
  PanelLeftClose, PanelLeftOpen, PanelLeft, Sparkles
} from 'lucide-react';
import './App.css';

// Import helper functions and constants
import { GARMENT_CATEGORIES, getCleanImageUrl } from './utils/designHelpers';

// Code-split heavy views with React.lazy for instant initial page loading & smaller initial bundle
const DashboardView = lazy(() => import('./components/DashboardView'));
const DesignView = lazy(() => import('./components/DesignView'));
const MaterialVerificationView = lazy(() => import('./components/MaterialVerificationView'));
const MaterialIssueView = lazy(() => import('./components/MaterialIssueView'));
const ExtraMaterialIssueView = lazy(() => import('./components/ExtraMaterialIssueView'));
const GeneratePOView = lazy(() => import('./components/GeneratePOView'));
const MaterialDetailsView = lazy(() => import('./components/MaterialDetailsView'));
const ReportsHistoryView = lazy(() => import('./components/ReportsHistoryView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const AuthView = lazy(() => import('./components/AuthView'));
const ApprovalQueueView = lazy(() => import('./components/ApprovalQueueView'));
const ReturnMaterialView = lazy(() => import('./components/ReturnMaterialView'));
const PuneetZip = lazy(() => import('./components/pogenerate'));
const HistoryView = lazy(() => import('./components/HistoryView'));
const PublicScanView = lazy(() => import('./components/PublicScanView'));
const ScannerLogsView = lazy(() => import('./components/ScannerLogsView'));
const FabricRgpForm = lazy(() => import('./components/rgp'));
const ReDownloadView = lazy(() => import('./components/ReDownloadView'));
const WeightCapture = lazy(() => import('./components/WeightCapture'));
const ManuallyWeightCapture = lazy(() => import('./components/ManuallyWeightCapture'));
const MaterialTransferView = lazy(() => import('./components/MaterialTransferView'));
const POVerificationView = lazy(() => import('./components/POVerificationView'));
const WarehouseLocationView = lazy(() => import('./components/WarehouseLocationView'));
const OnlyCutting = lazy(() => import('./components/OnlyCutting'));
const BoneIssueView = lazy(() => import('./components/BoneIssueView'));

// Default Mock Data Arrays
const initialMaterials = [
  { id: 'MT1008', name: 'COTTON', category: 'DYEING', stock: 1987, unit: 'Pcs', cost: 0, threshold: 50, color: 'White', location: 'hall 1 rack 2 (8 pkts), hall 2 rack 3 (2 pkts)', packets: 10 },
  { id: 'MT1009', name: 'ZIP', category: 'DYEING', stock: 2097, unit: 'Pcs', cost: 0, threshold: 50, color: 'Blue', location: 'HALL 3 RACK 7', packets: 20 },
  { id: 'MT1010', name: 'BUTTON', category: 'DYEING', stock: 1511, unit: 'Pcs', cost: 0, threshold: 50, color: 'Red', location: 'HALL 3 RACK 4', packets: 5 },
  { id: 'MT1011', name: 'fabric', category: 'Dyeing', stock: 223, unit: 'Pcs', cost: 0, threshold: 50, color: 'Black', location: 'hall 3 rack 8', packets: 7 },
  { id: 'MT1012', name: 'BUTTON', category: 'button', stock: 1511, unit: 'Pcs', cost: 0, threshold: 50, color: 'Gold', location: 'HALL 3 RACK 4', packets: 5 },
  { id: 'MT1013', name: 'lastic', category: 'Zipper', stock: 223, unit: 'Pcs', cost: 0, threshold: 50, color: 'White', location: 'HALL 3 RACK 9', packets: 5 },
  { id: 'MT1014', name: 'zip', category: 'zip', stock: 2225, unit: 'Pcs', cost: 0, threshold: 50, color: 'Black', location: 'hall 4', packets: 10 },
  { id: 'MT1015', name: 'lastic', category: 'lastic', stock: 223, unit: 'Pcs', cost: 0, threshold: 50, color: 'Silver', location: 'HALL 3 RACK 9', packets: 5 },
  { id: 'MT1016', name: 'zip', category: 'zip', stock: 2285, unit: 'Pcs', cost: 0, threshold: 50, color: 'Grey', location: 'hall 5 rack 1', packets: 8 },
  { id: 'M1302', name: 'Organic Cotton Fabric Roll', category: 'Fabric', stock: 2400, unit: 'meters', cost: 25.00, threshold: 200, color: 'Pure White', location: 'Main Store' },
  { id: 'M1303', name: 'Indigo Denim Raw Roll', category: 'Fabric', stock: 850, unit: 'meters', cost: 45.00, threshold: 150, color: 'Raw Deep Indigo', location: 'Main Store' },
  { id: 'M1304', name: 'YKK Brass Zippers (15cm)', category: 'Trim', stock: 150, unit: 'pieces', cost: 2.50, threshold: 200, color: 'Matte Gold', location: 'Main Store' },
  { id: 'M1305', name: 'Polyester Thread Spool', category: 'Trim', stock: 45, unit: 'rolls', cost: 8.00, threshold: 50, color: 'Neutral Gray', location: 'Main Store' },
  { id: 'M1306', name: 'Metal Rivets (Pack of 100)', category: 'Trim', stock: 60, unit: 'pieces', cost: 5.00, threshold: 20, color: 'Silver Metallic', location: 'Main Store' },
  { id: 'M1307', name: 'Printed Satin Brand Labels', category: 'Accessory', stock: 500, unit: 'pieces', cost: 0.80, threshold: 100, color: 'Glossy White', location: 'Main Store' }
];

const initialDesigns = [
  {
    id: '11000',
    name: 'Summer Denim Jacket',
    lotNo2: 'MH-4458',
    brand: 'Zara',
    category: 'JACKET',
    designer: 'Admin',
    fabricType: 'Raw Denim Cotton 100%',
    targetSizes: 'S, M, L, XL',
    colorCode: '#1e40af',
    status: 'In Verification',
    date: '10/08/2023',
    comments: '',
    section: 'Men',
    season: 'Winter',
    style: 'ST-9921',
    tapeLace: 'No',
    bottomType: 'N/A',
    zip: 'Yes',
    sticker: 'No',
    collar: 'No',
    bone: 'No',
    fullBaju: 'No',
    bom: [
      { name: 'Zip', status: 'Yes', detail: '1', description: 'YKK Brass Zippers (15cm)', materialId: 'M1304' },
      { name: 'Button', status: 'Yes', detail: '6', description: 'Metal Rivets (Pack of 100)', materialId: 'M1306' },
      { name: 'Elastic', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Tape / Lace', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Rib', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Collar', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Sticker / Label', status: 'Yes', detail: '1', description: 'Printed Satin Brand Labels', materialId: 'M1307' },
      { name: 'Thread', status: 'Yes', detail: '1', description: 'Polyester Thread Spool', materialId: 'M1305' },
      { name: 'Pocket', status: 'Yes', detail: '2', description: 'Chest pockets', materialId: '' },
      { name: 'Drawstring / Nara', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Hook, buckle, velcro', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Interlining / fusing', status: 'Yes', detail: '1', description: 'Placket fusing', materialId: '' }
    ],
    totalCost: 0
  },
  {
    id: '11001',
    name: 'Organic Cotton Polo Shirt',
    lotNo2: 'MH-4459',
    brand: 'Nike',
    category: 'T-SHIRT COLLAR',
    designer: 'Admin',
    fabricType: 'Pima Cotton Pique',
    targetSizes: 'M, L, XL',
    colorCode: '#059669',
    status: 'Approved',
    date: '08/08/2023',
    comments: '',
    section: 'Men',
    season: 'Summer',
    style: 'TS-2201',
    tapeLace: 'No',
    bottomType: 'N/A',
    zip: 'No',
    sticker: 'No',
    collar: 'Yes',
    bone: 'No',
    fullBaju: 'No',
    bom: [
      { name: 'Zip', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Button', status: 'Yes', detail: '3', description: 'Polo neck buttons', materialId: '' },
      { name: 'Elastic', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Tape / Lace', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Rib', status: 'Yes', detail: '2', description: 'Collar & cuff rib', materialId: '' },
      { name: 'Collar', status: 'Yes', detail: '1', description: 'Flat knit collar', materialId: '' },
      { name: 'Sticker / Label', status: 'Yes', detail: '1', description: 'Printed Satin Brand Labels', materialId: 'M1307' },
      { name: 'Thread', status: 'Yes', detail: '1', description: 'Polyester Thread Spool', materialId: 'M1305' },
      { name: 'Pocket', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Drawstring / Nara', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Hook, buckle, velcro', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Interlining / fusing', status: 'Yes', detail: '1', description: 'Collar stand fusing', materialId: '' }
    ],
    totalCost: 0
  },
  {
    id: '11002',
    name: 'Linen Comfort Trousers',
    lotNo2: 'MH-4460',
    brand: 'H&M',
    category: 'LOWER',
    designer: 'Admin',
    fabricType: 'Pure Linen Weave',
    targetSizes: 'S, M, L',
    colorCode: '#d97706',
    status: 'Approved',
    date: '02/08/2023',
    comments: '',
    section: 'Women',
    season: 'Summer',
    style: 'TR-3304',
    tapeLace: 'No',
    bottomType: 'Elastic mohri',
    zip: 'No',
    sticker: 'No',
    collar: 'No',
    bone: 'No',
    fullBaju: 'No',
    bom: [
      { name: 'Zip', status: 'Yes', detail: '1', description: 'YKK Fly Zipper', materialId: '' },
      { name: 'Button', status: 'Yes', detail: '1', description: 'Waistband button', materialId: '' },
      { name: 'Elastic', status: 'Yes', detail: '1', description: 'Waistband elastic', materialId: '' },
      { name: 'Tape / Lace', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Rib', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Collar', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Sticker / Label', status: 'Yes', detail: '1', description: 'Brand Label', materialId: '' },
      { name: 'Thread', status: 'Yes', detail: '1', description: 'Polyester Thread Spool', materialId: 'M1305' },
      { name: 'Pocket', status: 'Yes', detail: '2', description: 'Side pockets', materialId: '' },
      { name: 'Drawstring / Nara', status: 'Yes', detail: '1', description: 'Waist drawstring', materialId: '' },
      { name: 'Hook, buckle, velcro', status: 'No', detail: '', description: '', materialId: '' },
      { name: 'Interlining / fusing', status: 'Yes', detail: '1', description: 'Waistband fusing', materialId: '' }
    ],
    totalCost: 0
  }
];

const initialPOs = [
  {
    id: 'PO1301',
    poNumber: 'PO-11000',
    vendorName: 'YKK Trim Solutions',
    vendorEmail: 'sales@ykk-trims.com',
    vendorAddress: 'Industrial Block C, Mumbai',
    designName: 'Summer Denim Jacket',
    designCategory: 'JACKET',
    items: [
      { name: 'YKK Brass Zippers (15cm)', qty: 500, unit: 'pieces', price: 2.50 },
      { name: 'Metal Rivets (Pack of 100)', qty: 627, unit: 'pieces', price: 5.00 }
    ],
    subtotal: 4385,
    taxRate: 18,
    tax: 789.3,
    total: 38500, // matches R 38,500 in dashboard image
    date: '23/02/2023',
    deliveryDate: '15/03/2023',
    status: 'Sent to Vendor'
  }
];

const initialVendors = [
  { id: 'V101', name: 'YKK Trim Solutions', email: 'sales@ykk-trims.com', address: 'Industrial Block C, Mumbai', materialsJoined: 'Metal Buttons & Rivets' },
  { id: 'V102', name: 'EuroCotton Mills', email: 'orders@eurocotton.co', address: 'Textile Center Hub, Gujarat', materialsJoined: 'Fabrics & Yarn' },
  { id: 'V103', name: 'Global Tags & Trims', email: 'info@globaltags.com', address: 'Apparel Center Complex, Mumbai', materialsJoined: 'Labels, Tags & Hangers' }
];

const getRolePanel = (role) => {
  const r = (role || '').toLowerCase();
  if (r === 'admin' || r === 'supply chain lead') return 'admin';
  if (r === 'designer' || r === 'lead designer' || r === 'pattern auditor') return 'designer';
  return 'store';
};

const hasTabAccess = (tabName, role) => {
  const panel = getRolePanel(role);
  if (panel === 'admin') {
    return [
      'dashboard',
      'design',
      'material_verification',
      'rgp',
      'zip_po',
      'dori_po',
      'bone_issue',
      'bone_po',
      'generate_po',
      'history',
      'scanner_logs',
      'weight_capture',
      'manually_weight_capture',
      'material_issue',
      'extra_material_issue',
      'return_material',
      'material_details',
      'material_transfer',
      'warehouse_locations',
      'reports_history',
      'settings',
      'approval_queue',
      'po_verification',
      're_download',
      'only_cutting'
    ].includes(tabName);
  }
  if (panel === 'designer') {
    return [
      'dashboard',
      'design',
      'material_verification',
      'rgp',
      'zip_po',
      'dori_po',
      'bone_issue',
      'bone_po',
      'generate_po',
      'history',
      'scanner_logs',
      'po_verification',
      'warehouse_locations',
      'approval_queue',
      'only_cutting',
      'material_details'
    ].includes(tabName);
  }
  if (panel === 'store') {
    return [
      'dashboard',
      'weight_capture',
      'manually_weight_capture',
      'material_issue',
      'extra_material_issue',
      'return_material',
      'material_details',
      'material_transfer',
      'warehouse_locations',
      'history',
      'scanner_logs',
      'po_verification',
      'approval_queue',
      'rgp',
      'generate_po',
      'bone_issue',
      'bone_po',
      'only_cutting'
    ].includes(tabName);
  }
  return false;
};

const TAB_ROUTES = {
  dashboard: '/dashboard',
  design: '/design',
  material_verification: '/material-verification',
  material_issue: '/material-issue',
  extra_material_issue: '/extra-material-issue',
  return_material: '/return-material',
  generate_po: '/generate-po',
  re_download: '/re-download',
  zip_po: '/zip-po',
  dori_po: '/dori-po',
  bone_issue: '/bone-issue',
  bone_po: '/bone-issue',
  material_details: '/material-details',
  reports_history: '/reports-history',
  settings: '/settings',
  approval_queue: '/approval-queue',
  history: '/history',
  scanner_logs: '/scanner-logs',
  rgp: '/rgp',
  weight_capture: '/weight-capture',
  manually_weight_capture: '/manually-weight-capture',
  material_transfer: '/material-transfer',
  warehouse_locations: '/warehouse-locations',
  po_verification: '/po-verification',
  only_cutting: '/only-cutting',
};

const PATH_TO_TAB = Object.entries(TAB_ROUTES).reduce((acc, [tab, path]) => {
  acc[path] = tab;
  acc[path.replace(/-/g, '_')] = tab;
  return acc;
}, { '/': 'dashboard', '/material-detail': 'material_details', '/material_detail': 'material_details', '/bone-po': 'bone_issue', '/bone_po': 'bone_issue' });

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState(null);
  const [isVerifyingToken, setIsVerifyingToken] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  const activeTab = PATH_TO_TAB[location.pathname] || 'dashboard';

  const setActiveTab = (tabName) => {
    const targetPath = TAB_ROUTES[tabName] || '/dashboard';
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('mh_sidebar_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  const toggleSidebar = () => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(prev => !prev);
    } else {
      setIsSidebarCollapsed(prev => {
        const next = !prev;
        try {
          localStorage.setItem('mh_sidebar_collapsed', next ? 'true' : 'false');
        } catch (e) {}
        return next;
      });
    }
  };

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [designMenuOpen, setDesignMenuOpen] = useState(true);
  const [adminDesignMenuOpen, setAdminDesignMenuOpen] = useState(true);
  const [adminStoreMenuOpen, setAdminStoreMenuOpen] = useState(true);
  const [prefilledLotNo, setPrefilledLotNo] = useState('');
  const [prefilledPoType, setPrefilledPoType] = useState('zip');
  const [prefilledPoData, setPrefilledPoData] = useState(null);
  const [prefilledRgpData, setPrefilledRgpData] = useState(null);
  const [customAlert, setCustomAlert] = useState(null);

  // QR Scanning routing states
  const [scanAction, setScanAction] = useState(null);
  const [scanLot, setScanLot] = useState(null);
  const [scanPoType, setScanPoType] = useState(null);

  useEffect(() => {
    window.alert = (message) => {
      setCustomAlert(message);
    };

    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2200);

    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const lot = params.get('lot');
    const po = params.get('po');
    const poType = params.get('poType');
    const rgp = params.get('rgp');
    if (action) {
      setScanAction(action);
    }
    if (lot) {
      setScanLot(lot);
    } else if (po) {
      setScanLot(po);
    } else if (rgp) {
      setScanLot(rgp);
    }
    if (poType) {
      setScanPoType(poType);
    }

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const handleRedirectToTab = (tabName) => {
    setActiveTab(tabName);
  };
  const handleRedirectToZipPO = (lotNo, type = 'zip') => {
    setPrefilledLotNo(lotNo);
    setPrefilledPoType(type);
    if (type === 'dori') {
      setActiveTab('dori_po');
    } else if (type === 'bone' || type === 'bone_issue') {
      setActiveTab('bone_issue');
    } else {
      setActiveTab('zip_po');
    }
  };
  const handleRedirectToPO = (poData) => {
    setPrefilledPoData(poData);
    setActiveTab('generate_po');
  };
  const handleRedirectToRGP = (rgpData) => {
    setPrefilledRgpData(rgpData);
    setActiveTab('rgp');
  };
  const [designs, setDesigns] = useState(() => {
    const saved = localStorage.getItem('gpdms_designs');
    const parsed = saved ? JSON.parse(saved) : initialDesigns;
    return [...parsed].sort((a, b) => {
      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA;
      }
      return b.id.localeCompare(a.id);
    });
  });
  const [materials, setMaterials] = useState(initialMaterials);
  // POs — backed by database
  const [pos, setPOs] = useState(initialPOs);
  // Vendors — backed by database
  const [vendors, setVendors] = useState(initialVendors);

  const settingsHydratedRef = useRef(false);

  // Warehouse Halls/Zones configuration state
  const [halls, setHalls] = useState(() => {
    const saved = localStorage.getItem('warehouse_halls');
    if (!saved) return ['Main Store'];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : ['Main Store'];
    } catch {
      return ['Main Store'];
    }
  });

  useEffect(() => {
    localStorage.setItem('warehouse_halls', JSON.stringify(halls));
    if (settingsHydratedRef.current) {
      fetch(`${getBackendUrl()}/api/settings/warehouse_halls`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: halls })
      }).catch(() => {});
    }
  }, [halls]);

  // Warehouse Racks configuration state (manually configured locations only)
  const [racks, setRacks] = useState(() => {
    const saved = localStorage.getItem('warehouse_racks');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Purge any legacy 350-item default seeded racks
        const isLegacyDemo = parsed.length > 50 || parsed.some(r => String(r.id || '').startsWith('rack-hall-'));
        if (isLegacyDemo) {
          localStorage.setItem('warehouse_racks', JSON.stringify([]));
          return [];
        }
        return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('warehouse_racks', JSON.stringify(racks));
    if (settingsHydratedRef.current) {
      fetch(`${getBackendUrl()}/api/settings/warehouse_racks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: racks })
      }).catch(() => {});
    }
  }, [racks]);

  // Accessories & designers — backed by database (settings table)
  const [accessoriesList, setAccessoriesList] = useState([
    'Label', 'Tag', 'Dori', 'Zip', 'Button', 'Elastic', 'Tape / Lace', 'Rib', 'Collar',
    'Sticker / Label', 'Thread', 'Pocket', 'Drawstring / Nara',
    'Hook, buckle, velcro', 'Interlining / fusing', 'Bone', 'Full Baju'
  ]);

  const [designersList, setDesignersList] = useState(['Admin']);

  // Settings & Themes
  const [currencySymbol, setCurrencySymbol] = useState(() => {
    return localStorage.getItem('gpdms_currency') || 'R';
  });
  const [defaultTax, setDefaultTax] = useState(() => {
    return Number(localStorage.getItem('gpdms_tax') || '18');
  });
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    return localStorage.getItem('gpdms_darktheme') === 'true';
  });
  const [allowMaterialPhotoEdit, setAllowMaterialPhotoEdit] = useState(true);
  const [allowWarehouseAddRack, setAllowWarehouseAddRack] = useState(() => {
    const saved = localStorage.getItem('gpdms_allow_warehouse_add_rack');
    return saved !== null ? saved === 'true' : false; // OFF by default as requested
  });

  // Modal State
  const [isNewDesignModalOpen, setIsNewDesignModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState(() => {
    const saved = localStorage.getItem('dismissed_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('dismissed_notifications', JSON.stringify(dismissedNotifications));
  }, [dismissedNotifications]);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  // Issue logs — backed by database
  const [issueLogs, setIssueLogs] = useState([]);

  // Approval requests state — backed by database, NOT localStorage
  const [approvalRequests, setApprovalRequests] = useState([]);

  // Form states for simple modal dashboard design creation (no name — Lot No IS the identifier)
  const [mCategory, setMCategory] = useState('T-SHIRT R/N');
  const [mFabric, setMFabric] = useState('Cotton Knit');
  const [mLotNo, setMLotNo] = useState('');
  const [mLotNo2, setMLotNo2] = useState('');
  const [mBrand, setMBrand] = useState('');
  const [mStyle, setMStyle] = useState('');
  const [mSection, setMSection] = useState('Men');
  const [mSeason, setMSeason] = useState('Summer');
  const [syncedLots, setSyncedLots] = useState([]);
  const [mImageUrl, setMImageUrl] = useState('');
  const [mQuantity, setMQuantity] = useState(100);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('gpdms_designs', JSON.stringify(designs));
  }, [designs]);

  // Materials, POs, vendors, accessories, designers, issueLogs — synced to DB, no localStorage needed

  useEffect(() => {
    localStorage.setItem('gpdms_currency', currencySymbol);
  }, [currencySymbol]);

  // approvalRequests are backed by DB — no localStorage persistence

  useEffect(() => {
    localStorage.setItem('gpdms_tax', defaultTax.toString());
  }, [defaultTax]);
  useEffect(() => {
    localStorage.setItem('gpdms_darktheme', isDarkTheme.toString());
    if (isDarkTheme) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [isDarkTheme]);

  // Guard activeTab based on currentUser role access
  useEffect(() => {
    if (currentUser) {
      if (!hasTabAccess(activeTab, currentUser.role)) {
        setActiveTab('dashboard');
      }
    }
  }, [currentUser, activeTab]);

  // ── Document Title — update on every page navigation ────────────────
  useEffect(() => {
    const pageTitles = {
      dashboard: 'Dashboard',
      design: 'Below of Material',
      material_verification: 'Stock Accessories',
      rgp: 'Returnable Gate Pass',
      zip_po: 'Zip Purcharge Orders',
      dori_po: 'Dori Purcharge Orders',
      bone_issue: 'Bone Issue',
      bone_po: 'Bone Issue',
      generate_po: 'Generate PO',
      history: 'Production Work',
      scanner_logs: 'Scanner Log',
      weight_capture: 'Material Add',
      material_issue: 'Material Issue',
      extra_material_issue: 'Extra Material Issue',
      return_material: 'Return Material',
      material_details: 'Material Detail',
      material_transfer: 'Material Transfer',
      warehouse_locations: 'Warehouse Locations',
      reports_history: 'Report and History',
      settings: 'Setting',
      approval_queue: currentUser?.role === 'Admin' ? 'Approval Queue' : 'My Requests'
    };
    const title = pageTitles[activeTab] || 'MH Store';
    document.title = `Garment PDMS - ${title}`;
  }, [activeTab, currentUser]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove(
        'print-transactions-mode',
        'print-materials-mode',
        'print-techpack-mode',
        'print-single-issue-slip-mode',
        'print-lot-audit-mode',
        'print-issue-logs-mode',
        'print-po-mode',
        'print-barcodes-only',
        'print-approval-request-mode',
        'print-issue-preview-mode'
      );
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  // Fetch synced lot lists from Google Sheet via backend
  useEffect(() => {
    const fetchSyncedLots = async () => {
      try {
        const response = await fetch(`${getBackendUrl()}/api/lots`);
        if (response.ok) {
          const data = await response.json();
          setSyncedLots(data);
        }
      } catch (err) {
        console.error('Failed to fetch synced lots:', err);
      }
    };
    fetchSyncedLots();
  }, []);

  // Fetch designs from database via backend on mount
  useEffect(() => {
    const fetchDesigns = async () => {
      try {
        const response = await fetch(`${getBackendUrl()}/api/designs`);
        if (response.ok) {
          const data = await response.json();
          const sorted = data.sort((a, b) => {
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
          });
          setDesigns(prev => {
            if (JSON.stringify(prev) === JSON.stringify(sorted)) {
              return prev;
            }
            return sorted;
          });
        }
      } catch (err) {
        console.error('Failed to fetch designs from DB:', err);
      }
    };
    fetchDesigns();

    // Poll every 5 seconds so designs stay synced across panels in real-time
    const pollInterval = setInterval(fetchDesigns, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  // Fetch materials from database on mount & poll every 3 seconds for live sync
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const response = await fetch(`${getBackendUrl()}/api/materials`);
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) setMaterials(data);
        }
      } catch (err) {
        console.error('Failed to fetch materials from DB:', err);
      }
    };
    fetchMaterials();

    const interval = setInterval(fetchMaterials, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch approval requests from database on mount
  useEffect(() => {
    const fetchApprovalRequests = async () => {
      try {
        const response = await fetch(`${getBackendUrl()}/api/approval-requests`);
        if (response.ok) {
          const data = await response.json();
          setApprovalRequests(prev => {
            if (JSON.stringify(prev) === JSON.stringify(data)) {
              return prev;
            }
            return data;
          });
        }
      } catch (err) {
        console.error('Failed to fetch approval requests from DB:', err);
      }
    };
    fetchApprovalRequests();

    // Poll every 5 seconds so notifications trigger promptly
    const pollInterval = setInterval(fetchApprovalRequests, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.1);
      gain2.gain.setValueAtTime(0.12, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.error('Failed to play web audio notification:', e);
    }
  };

  useEffect(() => {
    if (toast) {
      playNotificationSound();
    }
  }, [toast]);

  const prevRequestsRef = useRef([]);

  // Helper to resolve request type labels in notifications
  const getRequestTypeText = (type) => {
    if (type === 'material_issue') return 'Material Issue';
    if (type === 'design_verification') return 'Design Verification';
    if (type === 'material_delete') return 'Material Delete';
    return 'Request';
  };

  // Detect new requests or status changes to trigger Live Toast Notifications
  useEffect(() => {
    if (!currentUser) {
      prevRequestsRef.current = approvalRequests;
      return;
    }

    const prevRequests = prevRequestsRef.current;

    if (prevRequests && prevRequests.length > 0) {
      approvalRequests.forEach(req => {
        const prev = prevRequests.find(p => p.id === req.id);

        // 1. Detect new requests (useful for Admin and Designer notification toast)
        if (!prev) {
          if (req.status === 'pending') {
            if (req.type === 'design_verification') {
              setToast({
                type: 'success',
                title: 'Design Verification Required',
                message: 'new design is ready please verify it',
                onClick: currentUser.role === 'Admin' ? () => setActiveTab('approval_queue') : null
              });
            } else {
              if (currentUser.role === 'Admin' && req.requesterName !== currentUser.name) {
                setToast({
                  type: 'success',
                  title: 'New Request Submitted',
                  message: `New request ${req.id} submitted by ${req.requesterName} for ${getRequestTypeText(req.type)}.`
                });
              }
            }
            setTimeout(() => setToast(null), 8000);
          }
        }
        // 2. Detect status transitions (useful for Requester)
        else if (prev.status === 'pending' && req.status !== 'pending') {
          if (req.requesterName === currentUser.name) {
            const isApproved = req.status === 'approved';
            if (req.type === 'design_verification') {
              setToast({
                type: isApproved ? 'success' : 'error',
                title: isApproved ? 'Design Approved' : 'Design Rejected',
                message: isApproved
                  ? `Accept u are design lot no ${req.lotId}`
                  : `Reject u are design lot no ${req.lotId}. Reason: ${req.rejectionReason || 'No reason provided'}`
              });
            } else {
              setToast({
                type: isApproved ? 'success' : 'error',
                title: isApproved ? 'Request Approved' : 'Request Rejected',
                message: isApproved
                  ? `Your request (ID: ${req.id}) for ${getRequestTypeText(req.type)} has been APPROVED.`
                  : `Your request (ID: ${req.id}) has been REJECTED. Reason: ${req.rejectionReason || 'No reason provided'}`
              });
            }
            setTimeout(() => setToast(null), 8000);
          }
        }
      });
    }

    prevRequestsRef.current = approvalRequests;
  }, [approvalRequests, currentUser]);

  // Fetch purchase orders from database with periodic sync
  useEffect(() => {
    const fetchPOs = async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/api/pos`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setPOs(data);
        }
      } catch (err) {
        console.error('Failed to fetch POs from DB:', err);
      }
    };
    fetchPOs();
    const poInterval = setInterval(fetchPOs, 5000);
    return () => clearInterval(poInterval);
  }, []);

  // Fetch vendors from database with periodic sync
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/api/vendors`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setVendors(data);
        }
      } catch (err) {
        console.error('Failed to fetch vendors from DB:', err);
      }
    };
    fetchVendors();
    const vendorInterval = setInterval(fetchVendors, 10000);
    return () => clearInterval(vendorInterval);
  }, []);

  // Fetch settings (accessories & designers lists, warehouse halls & racks) from database with periodic sync
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          if (data.accessoriesList && data.accessoriesList.length > 0)
            setAccessoriesList(data.accessoriesList);
          if (data.designersList && data.designersList.length > 0) {
            const cleaned = data.designersList.filter(d => !['sarah connor', 'michael scott'].includes(String(d).toLowerCase().trim()));
            setDesignersList(cleaned.length > 0 ? (cleaned.includes('Admin') ? cleaned : ['Admin', ...cleaned]) : ['Admin']);
          }
          if (data.warehouseHalls && data.warehouseHalls.length > 0)
            setHalls(data.warehouseHalls);
          if (data.warehouseRacks && data.warehouseRacks.length > 0)
            setRacks(data.warehouseRacks);
          if (data.allowMaterialPhotoEdit !== undefined)
            setAllowMaterialPhotoEdit(Boolean(data.allowMaterialPhotoEdit));
          if (data.allowWarehouseAddRack !== undefined) {
            setAllowWarehouseAddRack(Boolean(data.allowWarehouseAddRack));
            localStorage.setItem('gpdms_allow_warehouse_add_rack', Boolean(data.allowWarehouseAddRack).toString());
          }
        }
      } catch (err) {
        console.error('Failed to fetch settings from DB:', err);
      } finally {
        settingsHydratedRef.current = true;
      }
    };
    fetchSettings();
    const settingsInterval = setInterval(fetchSettings, 10000);
    return () => clearInterval(settingsInterval);
  }, []);

  // Fetch issue logs from database on mount
  useEffect(() => {
    const fetchIssueLogs = async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/api/issue-logs`);
        if (res.ok) {
          const data = await res.json();
          setIssueLogs(data);
        }
      } catch (err) {
        console.error('Failed to fetch issue logs from DB:', err);
      }
    };
    fetchIssueLogs();
  }, []);

  useEffect(() => {
    // Session token validation check on mount
    const verifySession = async () => {
      const token = localStorage.getItem('gpdms_jwt_token');
      if (!token) {
        setIsVerifyingToken(false);
        return;
      }

      try {
        const response = await fetch(`${getBackendUrl()}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (response.ok) {
          setCurrentUser(data.user);
        } else {
          localStorage.removeItem('gpdms_jwt_token');
        }
      } catch (err) {
        console.error('Session verification error:', err);
      } finally {
        setIsVerifyingToken(false);
      }
    };

    verifySession();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('gpdms_jwt_token');
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const getInitials = (name) => {
    if (!name) return 'AD';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Dashboard Stats calculation
  const getStats = () => {
    const activeDesigns = designs.length;
    const pendingVerification = designs.filter(d => d.status === 'In Verification').length;



    // Alert if materials stock is below threshold
    const lowStockAlerts = materials.filter(m => m.stock <= m.threshold).length;

    return {
      activeDesigns,
      pendingVerification,
      poGeneratedToday: 112000, // Static baseline R 1,12,000 as per dashboard mock
      materialsCataloged: materials.reduce((sum, m) => sum + m.stock, 0),
      recentPoValue: pos[0]?.total || 38500, // PO1301 value is R 38,500
      criticalAlerts: lowStockAlerts
    };
  };

  // Compile Transactions matching layout
  const getTransactions = () => {
    const transactionsList = [];

    // Push designs in progress (Lot No is the primary identifier)
    designs.forEach(d => {
      transactionsList.push({
        id: d.id,
        itemName: `LOT ${d.id} \u2014 ${d.category}`,
        type: 'Product Design',
        date: d.date,
        status: d.status
      });
    });

    // Push POs
    pos.forEach(po => {
      transactionsList.push({
        id: po.id,
        itemName: `${po.vendorName} Order`,
        type: 'Purchase Order',
        date: po.date,
        status: po.status
      });
    });

    // Push material logs
    materials.forEach(m => {
      transactionsList.push({
        id: m.id,
        itemName: m.name,
        type: 'Material Details',
        date: '23/02/2023',
        status: m.stock <= m.threshold ? 'Low Stock' : 'Cataloged'
      });
    });

    // Sort transactions alphabetically by ID or date (let's keep ID order similar to mock)
    return transactionsList.sort((a, b) => a.id.localeCompare(b.id));
  };

  // State Updates
  const handleAddDesign = async (newDesign) => {
    const designWithTime = {
      ...newDesign,
      created_at: new Date().toISOString()
    };
    setDesigns(prev => {
      const exists = prev.some(d => d.id === designWithTime.id);
      let updated;
      if (exists) {
        updated = prev.map(d => d.id === designWithTime.id ? designWithTime : d);
      } else {
        updated = [designWithTime, ...prev];
      }
      return [...updated].sort((a, b) => {
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
      });
    });
    try {
      await fetch(`${getBackendUrl()}/api/designs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...designWithTime, actorName: currentUser?.name || 'Designer' })
      });
    } catch (err) {
      console.error('Failed to save design to SQLite:', err);
    }
  };

  const handleUpdateDesignStatus = async (id, status, comment = '') => {
    setDesigns(designs.map(d => {
      if (d.id === id) {
        return { ...d, status, comments: comment };
      }
      return d;
    }));

    // Trigger toast notification
    setToast({
      message: `Lot ${id} has been ${status === 'Approved' ? 'Verified & Approved' : 'Rejected for Revision'}.`,
      type: status === 'Approved' ? 'success' : 'error'
    });

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToast(prev => {
        if (prev && prev.message.includes(id)) {
          return null;
        }
        return prev;
      });
    }, 4000);

    try {
      await fetch(`${getBackendUrl()}/api/designs/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, comments: comment, actorName: currentUser?.name || 'Admin' })
      });
    } catch (err) {
      console.error('Failed to update design status in SQLite:', err);
    }
  };

  // Helper to sync material stock updates to backend (must be defined before handlers that use it)
  const syncMaterialsToDb = async (updatedMaterials) => {
    try {
      await Promise.all(
        updatedMaterials.map(m =>
          fetch(`${getBackendUrl()}/api/materials/${m.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(m)
          })
        )
      );
    } catch (err) {
      console.error('Failed to sync materials to DB:', err);
    }
  };

  const handleAddPO = (newPO) => {
    setPOs(prev => [newPO, ...prev]);

    // Add to raw materials stock when PO is compiled (buying fabric adds stock)
    const changedMaterials = [];
    const newMaterials = materials.map(m => {
      const poItem = newPO.items.find(i => i.name === m.name);
      if (poItem) {
        const updated = { ...m, stock: m.stock + poItem.qty };
        changedMaterials.push(updated);
        return updated;
      }
      return m;
    });
    setMaterials(newMaterials);
    if (changedMaterials.length > 0) syncMaterialsToDb(changedMaterials);

    // Save PO to database
    fetch(`${getBackendUrl()}/api/pos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPO)
    }).catch(err => console.error('Failed to save PO to DB:', err));
  };

  // Helper to persist a new issue/return log entry to the backend
  const syncIssueLogToDb = (log) => {
    fetch(`${getBackendUrl()}/api/issue-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    }).catch(err => console.error('Failed to save issue log to DB:', err));
  };

  const handleIssueMaterials = (lotId, volume, issuedItems, isReissue = false, personName = '', receiverName = '', receiverDept = '') => {
    // 1. Deduct materials stock counts
    const updatedMaterials = materials.map(m => {
      const issued = issuedItems.find(item => item.materialId === m.id);
      if (issued) {
        return {
          ...m,
          stock: Math.round(Math.max(0, m.stock - issued.totalRequired) * 100) / 100
        };
      }
      return m;
    });
    setMaterials(updatedMaterials);
    // Sync deducted stock to DB
    syncMaterialsToDb(updatedMaterials.filter(m => issuedItems.find(i => i.materialId === m.id)));

    // 2. Add audit trail log entry
    const design = designs.find(d => d.id === lotId);
    const newLog = {
      id: `${isReissue ? 'RI' : 'MI'}${Math.floor(1300 + Math.random() * 8000)}`,
      lotId,
      isReissue,
      category: design ? design.category : 'Unknown',
      volume,
      personName,
      receiverName: receiverName || '',
      receiverDept: receiverDept || '',
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      materials: issuedItems.map(item => ({
        name: item.materialName,
        bomItemName: item.bomItemName,
        qty: item.totalRequired,
        unit: item.unit
      }))
    };
    setIssueLogs(prev => [newLog, ...prev]);
    syncIssueLogToDb(newLog);
  };

  const handleReturnMaterials = (returnItems, comment = '', lotId = 'N/A') => {
    // 1. Add back to materials stock counts
    const updatedMaterials = materials.map(m => {
      const returned = returnItems.find(item => item.materialId === m.id);
      if (returned) {
        return {
          ...m,
          stock: Math.round((m.stock + returned.qty) * 100) / 100
        };
      }
      return m;
    });
    setMaterials(updatedMaterials);
    // Sync returned stock to DB
    syncMaterialsToDb(updatedMaterials.filter(m => returnItems.find(i => i.materialId === m.id)));

    // 2. Add audit trail log entry
    const design = designs.find(d => d.id === lotId);
    const newLog = {
      id: `MR${Math.floor(1300 + Math.random() * 8000)}`,
      lotId: lotId,
      isReissue: false,
      isReturn: true,
      category: design ? design.category : 'N/A',
      volume: 0,
      personName: comment || 'Material Return',
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      materials: returnItems.map(item => {
        const material = materials.find(m => m.id === item.materialId);
        return {
          name: material ? (material.color && material.color !== 'Default' ? `${material.name} (${material.color})` : material.name) : 'Unknown Material',
          bomItemName: item.bomItemName || 'Return',
          qty: item.qty,
          unit: material ? material.unit : 'pcs'
        };
      })
    };
    setIssueLogs(prev => [newLog, ...prev]);
    syncIssueLogToDb(newLog);
  };

  const handleAddMaterial = async (newMat) => {
    setMaterials(prev => [newMat, ...prev]);
    try {
      await fetch(`${getBackendUrl()}/api/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMat)
      });
    } catch (err) {
      console.error('Failed to save material to DB:', err);
    }
  };

  const handleDeleteMaterial = async (id) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
    try {
      await fetch(`${getBackendUrl()}/api/materials/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete material from DB:', err);
    }
  };

  // ── Approval Request Handlers ──────────────────────────────────────────────

  const handleSubmitApprovalRequest = async (type, payload, requester) => {
    const newRequest = {
      id: `AR${Date.now()}`,
      type,
      status: 'pending',
      requesterName: requester?.name || 'Unknown User',
      requesterRole: requester?.role || 'User',
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      ...payload
    };
    // Optimistic local update
    setApprovalRequests(prev => [newRequest, ...prev]);
    // Persist to DB so admin sees it
    try {
      await fetch(`${getBackendUrl()}/api/approval-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRequest)
      });
    } catch (err) {
      console.error('Failed to save approval request to DB:', err);
    }
  };

  const handleApproveRequest = async (requestId) => {
    const req = approvalRequests.find(r => r.id === requestId);
    if (!req) return;

    if (req.type === 'material_issue') {
      // Execute the actual material issue
      handleIssueMaterials(req.lotId, req.pieces, req.items, req.isReissue, req.personName);
      setToast({
        message: `Material issue for Lot ${req.lotId} by ${req.requesterName} has been approved and executed.`,
        type: 'success'
      });
      setTimeout(() => setToast(null), 5000);
    } else if (req.type === 'material_delete') {
      // Execute the material deletion
      handleDeleteMaterial(req.materialId);
      setToast({
        message: `Deletion of "${req.materialName}" by ${req.requesterName} has been approved.`,
        type: 'success'
      });
      setTimeout(() => setToast(null), 5000);
    } else if (req.type === 'design_verification') {
      // Update the design status in list and DB
      setDesigns(prev => prev.map(d => String(d.id) === String(req.lotId) ? { ...d, status: 'Approved' } : d));
      try {
        await fetch(`${getBackendUrl()}/api/designs/${req.lotId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Approved', comments: 'Approved via Queue', actorName: currentUser?.name || 'Admin' })
        });
      } catch (err) {
        console.error('Failed to update design status:', err);
      }
    } else if (req.type === 'inward_approval') {
      // Execute the material capture and stock update
      const inwardData = req.items?.[0] || req.items || {};
      try {
        await fetch(`${getBackendUrl()}/api/weight-capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inwardData)
        });
        fetchMaterials();
      } catch (inwErr) {
        console.error('Failed to execute inward on approval:', inwErr);
      }
      setToast({
        message: `Inward receipt of "${req.materialName}" (${req.pieces} pcs) by ${req.requesterName} has been approved and added to inventory.`,
        type: 'success'
      });
      setTimeout(() => setToast(null), 5000);
    }

    const formattedTime = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const resolvedDate = `${formattedTime} by ${currentUser?.name || 'Admin'} (ID: ${currentUser?.id || 'N/A'})`;
    setApprovalRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, status: 'approved', resolvedDate } : r)
    );
    try {
      await fetch(`${getBackendUrl()}/api/approval-requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', resolvedDate })
      });
    } catch (err) {
      console.error('Failed to update approval request in DB:', err);
    }
  };

  const handleRejectRequest = async (requestId, reason) => {
    const req = approvalRequests.find(r => r.id === requestId);
    const formattedTime = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const resolvedDate = `${formattedTime} by ${currentUser?.name || 'Admin'} (ID: ${currentUser?.id || 'N/A'})`;
    setApprovalRequests(prev =>
      prev.map(r => r.id === requestId
        ? { ...r, status: 'rejected', rejectionReason: reason, resolvedDate }
        : r
      )
    );
    if (req) {
      if (req.type === 'design_verification') {
        // Update the design status in list and DB
        setDesigns(prev => prev.map(d => String(d.id) === String(req.lotId) ? { ...d, status: 'Rejected', comments: reason } : d));
        try {
          await fetch(`${getBackendUrl()}/api/designs/${req.lotId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Rejected', comments: reason, actorName: currentUser?.name || 'Admin' })
          });
        } catch (err) {
          console.error('Failed to update design status on rejection:', err);
        }
      }
      setToast({
        message: `Request from ${req.requesterName} has been rejected.`,
        type: 'error'
      });
      setTimeout(() => setToast(null), 5000);
    }
    try {
      await fetch(`${getBackendUrl()}/api/approval-requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejectionReason: reason, resolvedDate })
      });
    } catch (err) {
      console.error('Failed to update rejection in DB:', err);
    }
  };

  const handleAddVendor = (newVendor) => {
    setVendors(prev => [...prev, newVendor]);
    fetch(`${getBackendUrl()}/api/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVendor)
    }).catch(err => console.error('Failed to save vendor to DB:', err));
  };

  const handleDeleteVendor = (id) => {
    setVendors(prev => prev.filter(v => v.id !== id));
    fetch(`${getBackendUrl()}/api/vendors/${id}`, { method: 'DELETE' })
      .catch(err => console.error('Failed to delete vendor from DB:', err));
  };

  const handleUpdateMaterial = async (updatedMat) => {
    setMaterials(prev => prev.map(m => m.id === updatedMat.id ? updatedMat : m));
    try {
      await fetch(`${getBackendUrl()}/api/materials/${updatedMat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMat)
      });
      setToast({
        type: 'success',
        title: 'Material Updated',
        message: `Successfully updated material "${updatedMat.name}".`
      });
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      console.error('Failed to update material in DB:', err);
    }
  };

  const handleResetDatabase = () => {
    setConfirmResetOpen(true);
  };

  const executeResetDatabase = () => {
    const sortedInitial = [...initialDesigns].sort((a, b) => {
      const numA = parseInt(a.id, 10);
      const numB = parseInt(b.id, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA;
      }
      return b.id.localeCompare(a.id);
    });
    setDesigns(sortedInitial);
    setMaterials(initialMaterials);
    setPOs(initialPOs);
    setVendors(initialVendors);
    setCurrencySymbol('R');
    setDefaultTax(18);
    setIsDarkTheme(false);
    setAccessoriesList([
      'Zip', 'Button', 'Elastic', 'Tape / Lace', 'Rib', 'Collar',
      'Sticker / Label', 'Thread', 'Pocket', 'Drawstring / Nara',
      'Hook, buckle, velcro', 'Interlining / fusing', 'Bone', 'Full Baju'
    ]);
    setDesignersList(['Admin']);
    setRacks([]);
    setHalls(['Hall 1']);
    localStorage.clear();
    setToast({
      type: 'success',
      title: 'Database Restored',
      message: 'Database restored successfully!'
    });
    setTimeout(() => setToast(null), 5000);
  };

  const handleAddAccessory = (name) => {
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (!accessoriesList.some(item => item.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...accessoriesList, trimmed];
      setAccessoriesList(updated);
      fetch(`${getBackendUrl()}/api/settings/accessories_list`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: updated })
      }).catch(err => console.error('Failed to update accessories in DB:', err));
    }
  };

  const handleDeleteAccessory = (name) => {
    const updated = accessoriesList.filter(item => item !== name);
    setAccessoriesList(updated);
    fetch(`${getBackendUrl()}/api/settings/accessories_list`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: updated })
    }).catch(err => console.error('Failed to update accessories in DB:', err));
  };

  const handleAddDesigner = (name) => {
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (!designersList.some(item => item.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...designersList, trimmed];
      setDesignersList(updated);
      fetch(`${getBackendUrl()}/api/settings/designers_list`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: updated })
      }).catch(err => console.error('Failed to update designers in DB:', err));
    }
  };

  const handleDeleteDesigner = (name) => {
    const updated = designersList.filter(item => item !== name);
    setDesignersList(updated);
    fetch(`${getBackendUrl()}/api/settings/designers_list`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: updated })
    }).catch(err => console.error('Failed to update designers in DB:', err));
  };

  const handleToggleAllowMaterialPhotoEdit = async (newValue) => {
    setAllowMaterialPhotoEdit(newValue);
    try {
      await fetch(`${getBackendUrl()}/api/settings/allow_material_photo_edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue })
      });
      setToast({
        type: 'success',
        title: 'Photo Control Setting Saved',
        message: newValue
          ? 'Material Photo Change & Delete option is now ENABLED.'
          : 'Material Photo Change & Delete option is now DISABLED (Normal View Panel Mode).'
      });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      console.error('Failed to save allow_material_photo_edit setting:', err);
    }
  };

  const handleToggleAllowWarehouseAddRack = async (newValue) => {
    setAllowWarehouseAddRack(newValue);
    localStorage.setItem('gpdms_allow_warehouse_add_rack', newValue.toString());
    try {
      await fetch(`${getBackendUrl()}/api/settings/allow_warehouse_add_rack`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue })
      });
      setToast({
        type: 'success',
        title: 'Warehouse Rack Control Saved',
        message: newValue
          ? 'Warehouse Rack & Hall Add option is now ENABLED.'
          : 'Warehouse Rack & Hall Add option is now DISABLED (Normal View Panel Mode).'
      });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      console.error('Failed to save allow_warehouse_add_rack setting:', err);
    }
  };

  const handleModalAutofillFromLot = async (lotNo) => {
    if (!lotNo) return;
    try {
      const response = await fetch(`${getBackendUrl()}/api/lot/${lotNo}`);
      if (!response.ok) throw new Error('Failed to fetch lot details');
      const data = await response.json();

      if (data.lotNo) setMLotNo(data.lotNo);
      if (data.lotNo2) setMLotNo2(data.lotNo2);
      if (data.brand) setMBrand(data.brand);
      if (data.style) setMStyle(data.style);
      if (data.fabric) setMFabric(data.fabric);
      if (data.imageUrl) setMImageUrl(getCleanImageUrl(data.imageUrl));
      if (data.quantity) setMQuantity(Number(data.quantity) || 100);

      if (data.section) {
        const secLower = data.section.trim().toLowerCase();
        if (secLower.includes('gents') || secLower.includes('men') || secLower.includes('man')) {
          setMSection('Men');
        } else if (secLower.includes('ladies') || secLower.includes('women') || secLower.includes('woman')) {
          setMSection('Women');
        } else if (secLower.includes('kids') || secLower.includes('kid')) {
          setMSection('Kids');
        } else if (secLower.includes('boys')) {
          setMSection('Boys');
        } else if (secLower.includes('girls')) {
          setMSection('Girls');
        } else if (secLower.includes('infant')) {
          setMSection('Infant');
        } else {
          setMSection('Unisex');
        }
      }

      if (data.season) {
        const seasLower = data.season.trim().toLowerCase();
        if (seasLower.includes('winter')) {
          setMSeason('Winter');
        } else {
          setMSeason('Summer');
        }
      }

      if (data.garmentType) {
        const typeNormalized = data.garmentType.trim().toUpperCase();
        const matchedCategory = GARMENT_CATEGORIES.find(cat =>
          cat === typeNormalized || cat.includes(typeNormalized) || typeNormalized.includes(cat)
        );
        if (matchedCategory) {
          setMCategory(matchedCategory);
        }
      }
    } catch (err) {
      console.error(err);
      setToast({
        type: 'error',
        title: 'Autofill Error',
        message: 'Error autofilling from sheet: ' + err.message
      });
      setTimeout(() => setToast(null), 5000);
    }
  };

  const handleCreateDesignFromModal = (e) => {
    e.preventDefault();

    const defaultBom = accessoriesList.map(name => ({
      name,
      status: 'No',
      detail: ''
    }));

    // Auto-increment Lot Number (Design ID) starting at 30000 — Lot No IS the name
    const numericIds = designs
      .map(d => parseInt(d.id, 10))
      .filter(id => !isNaN(id) && id >= 30000 && id < 60000);
    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
    const nextId = maxId >= 30000 ? maxId + 1 : 30000;

    const finalId = mLotNo.trim() || String(nextId);

    const newDesign = {
      id: finalId,
      name: finalId, // Lot No serves as primary identifier
      lotNo2: mLotNo2.trim() || 'N/A',
      brand: mBrand.trim() || 'Custom Brand',
      category: mCategory,
      designer: 'Lead Designer',
      fabricType: mFabric,
      targetSizes: 'M, L',
      colorCode: '#4f46e5',
      status: 'In Verification',
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      comments: '',
      section: mSection,
      season: mSeason,
      style: mStyle.trim() || 'ST-DEFAULT',
      tapeLace: 'No',
      bottomType: 'N/A',
      zip: 'No',
      sticker: 'No',
      collar: 'No',
      bone: 'No',
      fullBaju: 'No',
      bom: defaultBom,
      totalCost: 0,
      imageUrl: mImageUrl,
      quantity: Number(mQuantity) || 100
    };

    handleAddDesign(newDesign);

    // Reset Form States
    setMCategory('T-SHIRT R/N');
    setMFabric('Cotton Knit');
    setMLotNo('');
    setMLotNo2('');
    setMBrand('');
    setMStyle('');
    setMSection('Men');
    setMSeason('Summer');
    setMImageUrl('');
    setMQuantity(100);

    setIsNewDesignModalOpen(false);
    setActiveTab('design'); // go straight to design review
  };

  // If we are viewing a scanned QR code URL, bypass login/token check and render PublicScanView directly
  if (scanAction) {
    return (
      <Suspense fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main, #0f172a)' }}>
          <div className="spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-color, #6366f1)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        </div>
      }>
        <PublicScanView
          initialAction={scanAction}
          initialLot={scanLot || ''}
          initialPoType={scanPoType || ''}
          onBackToLogin={() => {
            // Clear query params so we go to normal login screen
            window.history.replaceState({}, document.title, window.location.pathname);
            setScanAction(null);
            setScanLot(null);
            setScanPoType(null);
          }}
        />
      </Suspense>
    );
  }

  if (showSplash || isVerifyingToken) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #020617 100%)',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        transition: 'opacity 0.5s ease',
      }}>
        {/* Pulsing glow ring */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '28px'
        }}>
          <div style={{
            position: 'absolute',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(2, 132, 199, 0.35) 0%, rgba(2, 132, 199, 0) 70%)',
            animation: 'pulseGlow 2s infinite ease-in-out'
          }} />

          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 25px -5px rgba(2, 132, 199, 0.25), 0 10px 10px -5px rgba(2, 132, 199, 0.2)',
            animation: 'floatLogo 3s infinite ease-in-out',
            zIndex: 1
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        </div>

        <h1 style={{
          fontSize: '32px',
          fontWeight: '900',
          letterSpacing: '6px',
          margin: '0 0 8px 0',
          background: 'linear-gradient(to right, #ffffff 30%, #c7d2fe 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 4px 12px rgba(0,0,0,0.3)',
          textTransform: 'uppercase'
        }}>
          MH STORE
        </h1>

        <p style={{
          fontSize: '11px',
          fontWeight: '600',
          letterSpacing: '3px',
          color: '#94a3b8',
          margin: '0 0 40px 0',
          textTransform: 'uppercase',
          textAlign: 'center',
          maxWidth: '80%'
        }}>
          Garment Production & Inventory Management System
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '160px',
            height: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              height: '100%',
              width: '50%',
              background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
              borderRadius: '2px',
              animation: 'loadingProgress 1.5s infinite ease-in-out'
            }} />
          </div>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#64748b',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>
            {isVerifyingToken ? 'Verifying Secure Session...' : 'Loading system data...'}
          </span>
        </div>

        <style>{`
          @keyframes pulseGlow {
            0%, 100% { transform: scale(0.9); opacity: 0.5; }
            50% { transform: scale(1.3); opacity: 0.9; }
          }
          @keyframes floatLogo {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @keyframes loadingProgress {
            0% { left: -50%; width: 30%; }
            50% { width: 50%; }
            100% { left: 120%; width: 30%; }
          }
        `}</style>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Suspense fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main, #0f172a)' }}>
          <div className="spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-color, #6366f1)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        </div>
      }>
        {/* Floating Theme Toggle on Login Screen */}
        <button
          className="theme-toggle auth-theme-toggle"
          style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setIsDarkTheme(!isDarkTheme)}
          title="Toggle Theme"
        >
          {isDarkTheme ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <AuthView onLoginSuccess={setCurrentUser} />
      </Suspense>
    );
  }

  return (
    <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Toast Notification */}
      {toast && (
        <div
          className="notification-toast"
          onClick={() => {
            if (toast.onClick) toast.onClick();
            setToast(null);
          }}
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            cursor: toast.onClick ? 'pointer' : 'default'
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle size={24} style={{ color: '#10b981', flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={24} style={{ color: '#f43e5c', flexShrink: 0 }} />
          )}
          <div className="notification-content">
            <div className="notification-title" style={{ color: toast.type === 'success' ? '#10b981' : '#f43e5c' }}>
              {toast.title || (toast.type === 'success' ? 'Success' : 'Error')}
            </div>
            <div className="notification-body">{toast.message}</div>
          </div>
          <button className="notification-close" onClick={(e) => { e.stopPropagation(); setToast(null); }}>
            <X size={18} />
          </button>
        </div>
      )}
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div
            className="sidebar-brand-group"
            onClick={() => isSidebarCollapsed && toggleSidebar()}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: isSidebarCollapsed ? 'pointer' : 'default', overflow: 'hidden' }}
            title={isSidebarCollapsed ? "Click to expand sidebar" : "MH STORE"}
          >
            <Layers3 size={28} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
            <span className="sidebar-logo-text">MH STORE</span>
          </div>
          <div className="sidebar-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="sidebar-collapse-toggle-btn desktop-only"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
              aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <button
              type="button"
              className="mobile-sidebar-close"
              onClick={() => setIsSidebarOpen(false)}
              title="Close Sidebar"
              aria-label="Close Sidebar"
            >
              <X size={20} />
            </button>
          </div>
          {isSidebarCollapsed && (
            <button
              type="button"
              className="sidebar-open-btn-collapsed"
              onClick={toggleSidebar}
              title="Open / Expand Sidebar (Ctrl+B)"
              aria-label="Open Sidebar"
            >
              <PanelLeftOpen size={18} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          <ul className="sidebar-menu">
            {/* Dashboard */}
            {hasTabAccess('dashboard', currentUser?.role) && (
              <li
                className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => handleTabClick('dashboard')}
                title="Dashboard Overview"
              >
                <LayoutDashboard size={18} />
                <span className="sidebar-text">Dashboard</span>
              </li>
            )}

            {/* ADMIN DESIGN PANEL SUBMENU */}
            {currentUser?.role === 'Admin' && (
              <>
                <li
                  className={`sidebar-item ${['design', 'material_verification', 'material_details', 'rgp', 'zip_po', 'dori_po', 'bone_po', 'generate_po', 'history', 'scanner_logs', 'only_cutting'].includes(activeTab) && activeTab !== 'history' ? 'active' : ''}`}
                  onClick={() => {
                    if (isSidebarCollapsed) {
                      setIsSidebarCollapsed(false);
                      setAdminDesignMenuOpen(true);
                    } else {
                      setAdminDesignMenuOpen(!adminDesignMenuOpen);
                    }
                  }}
                  title="Design Panel"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Scissors size={18} />
                    <span className="sidebar-text">Design Panel</span>
                  </div>
                  <span className="sidebar-arrow-icon">
                    {adminDesignMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                </li>
                {adminDesignMenuOpen && (
                  <ul className="sidebar-submenu">
                    <li className={`sidebar-subitem ${activeTab === 'design' ? 'active' : ''}`} onClick={() => handleTabClick('design')} title="Below of Material">
                      <span className="sidebar-text">Below of Material</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'material_verification' ? 'active' : ''}`} onClick={() => handleTabClick('material_verification')} title="Stock Accessories">
                      <span className="sidebar-text">Stock Accessories</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'material_details' ? 'active' : ''}`} onClick={() => handleTabClick('material_details')} title="Material Detail">
                      <span className="sidebar-text">Material Detail</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'rgp' ? 'active' : ''}`} onClick={() => handleTabClick('rgp')} title="Returnable Gate Pass">
                      <span className="sidebar-text">Returnable Gate Pass</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'zip_po' ? 'active' : ''}`} onClick={() => { handleTabClick('zip_po'); setPrefilledPoType('zip'); }} title="Zip Purcharge Orders">
                      <span className="sidebar-text">Zip Purcharge Orders</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'dori_po' ? 'active' : ''}`} onClick={() => { handleTabClick('dori_po'); setPrefilledPoType('dori'); }} title="Dori Purcharge Orders">
                      <span className="sidebar-text">Dori Purcharge Orders</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'bone_issue' || activeTab === 'bone_po' ? 'active' : ''}`} onClick={() => { handleTabClick('bone_issue'); }} title="Bone Issue">
                      <span className="sidebar-text">Bone Issue</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'generate_po' ? 'active' : ''}`} onClick={() => handleTabClick('generate_po')} title="Generate PO">
                      <span className="sidebar-text">Generate PO</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleTabClick('history')} title="Production Work">
                      <span className="sidebar-text">Production Work</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'scanner_logs' ? 'active' : ''}`} onClick={() => handleTabClick('scanner_logs')} title="Scanner Log">
                      <span className="sidebar-text">Scanner Log</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'only_cutting' ? 'active' : ''}`} onClick={() => handleTabClick('only_cutting')} title="Only Cutting">
                      <span className="sidebar-text">Only Cutting</span>
                    </li>
                  </ul>
                )}
              </>
            )}

            {/* ADMIN STORE PANEL SUBMENU */}
            {currentUser?.role === 'Admin' && (
              <>
                <li
                  className={`sidebar-item ${['weight_capture', 'manually_weight_capture', 'material_issue', 'extra_material_issue', 'return_material', 'material_details', 'material_transfer', 'warehouse_locations', 'history', 'scanner_logs', 'po_verification', 'rgp', 'generate_po'].includes(activeTab) && activeTab !== 'history' ? 'active' : ''}`}
                  onClick={() => {
                    if (isSidebarCollapsed) {
                      setIsSidebarCollapsed(false);
                      setAdminStoreMenuOpen(true);
                    } else {
                      setAdminStoreMenuOpen(!adminStoreMenuOpen);
                    }
                  }}
                  title="Store Panel"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Layers size={18} />
                    <span className="sidebar-text">Store Panel</span>
                  </div>
                  <span className="sidebar-arrow-icon">
                    {adminStoreMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                </li>
                {adminStoreMenuOpen && (
                  <ul className="sidebar-submenu">
                    <li className={`sidebar-subitem ${activeTab === 'weight_capture' ? 'active' : ''}`} onClick={() => handleTabClick('weight_capture')} title="Material Add (Scale)">
                      <span className="sidebar-text">Material Add (Scale)</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'manually_weight_capture' ? 'active' : ''}`} onClick={() => handleTabClick('manually_weight_capture')} title="Manual Material Add">
                      <span className="sidebar-text">Manual Material Add</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'material_issue' ? 'active' : ''}`} onClick={() => handleTabClick('material_issue')} title="Material Issue">
                      <span className="sidebar-text">Material Issue</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'extra_material_issue' ? 'active' : ''}`} onClick={() => handleTabClick('extra_material_issue')} title="Extra Material Issue">
                      <span className="sidebar-text">Extra Material Issue</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'return_material' ? 'active' : ''}`} onClick={() => handleTabClick('return_material')} title="Return Material">
                      <span className="sidebar-text">Return Material</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'material_details' ? 'active' : ''}`} onClick={() => handleTabClick('material_details')} title="Material Detail">
                      <span className="sidebar-text">Material Detail</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'material_transfer' ? 'active' : ''}`} onClick={() => handleTabClick('material_transfer')} title="Material Transfer">
                      <span className="sidebar-text">Material Transfer</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'warehouse_locations' ? 'active' : ''}`} onClick={() => handleTabClick('warehouse_locations')} title="Warehouse Locations">
                      <span className="sidebar-text">Warehouse Locations</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'rgp' ? 'active' : ''}`} onClick={() => handleTabClick('rgp')} title="Returnable Gate Pass">
                      <span className="sidebar-text">Returnable Gate Pass</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'generate_po' ? 'active' : ''}`} onClick={() => handleTabClick('generate_po')} title="Generate PO">
                      <span className="sidebar-text">Generate PO</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleTabClick('history')} title="Production Work">
                      <span className="sidebar-text">Production Work</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'scanner_logs' ? 'active' : ''}`} onClick={() => handleTabClick('scanner_logs')} title="Scanner Log">
                      <span className="sidebar-text">Scanner Log</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'po_verification' ? 'active' : ''}`} onClick={() => handleTabClick('po_verification')} title="PO Verification">
                      <span className="sidebar-text">PO Verification</span>
                    </li>
                    <li className={`sidebar-subitem ${activeTab === 'only_cutting' ? 'active' : ''}`} onClick={() => handleTabClick('only_cutting')} title="Only Cutting">
                      <span className="sidebar-text">Only Cutting</span>
                    </li>
                  </ul>
                )}
              </>
            )}

            {/* DESIGNER PANEL ITEMS (FLAT LIST) */}
            {currentUser?.role !== 'Admin' && getRolePanel(currentUser?.role) === 'designer' && (
              <>
                <li className={`sidebar-item ${activeTab === 'design' ? 'active' : ''}`} onClick={() => handleTabClick('design')} title="Below of Material">
                  <Scissors size={18} />
                  <span className="sidebar-text">Below of Material</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'material_verification' ? 'active' : ''}`} onClick={() => handleTabClick('material_verification')} title="Stock Accessories">
                  <CheckSquare size={18} />
                  <span className="sidebar-text">Stock Accessories</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'material_details' ? 'active' : ''}`} onClick={() => handleTabClick('material_details')} title="Material Detail">
                  <Layers size={18} />
                  <span className="sidebar-text">Material Detail</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'rgp' ? 'active' : ''}`} onClick={() => handleTabClick('rgp')} title="Returnable Gate Pass">
                  <Truck size={18} />
                  <span className="sidebar-text">Returnable Gate Pass</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'zip_po' ? 'active' : ''}`} onClick={() => { handleTabClick('zip_po'); setPrefilledPoType('zip'); }} title="Zip Purcharge Orders">
                  <FileText size={18} />
                  <span className="sidebar-text">Zip Purcharge Orders</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'dori_po' ? 'active' : ''}`} onClick={() => { handleTabClick('dori_po'); setPrefilledPoType('dori'); }} title="Dori Purcharge Orders">
                  <FileText size={18} />
                  <span className="sidebar-text">Dori Purcharge Orders</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'bone_issue' || activeTab === 'bone_po' ? 'active' : ''}`} onClick={() => { handleTabClick('bone_issue'); }} title="Bone Issue">
                  <Layers size={18} />
                  <span className="sidebar-text">Bone Issue</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'generate_po' ? 'active' : ''}`} onClick={() => handleTabClick('generate_po')} title="Generate PO">
                  <FileText size={18} />
                  <span className="sidebar-text">Generate PO</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleTabClick('history')} title="Production Work">
                  <History size={18} />
                  <span className="sidebar-text">Production Work</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'scanner_logs' ? 'active' : ''}`} onClick={() => handleTabClick('scanner_logs')} title="Scanner Log">
                  <QrCode size={18} />
                  <span className="sidebar-text">Scanner Log</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'po_verification' ? 'active' : ''}`} onClick={() => handleTabClick('po_verification')} title="PO Verification">
                  <CheckCircle size={18} />
                  <span className="sidebar-text">PO Verification</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'only_cutting' ? 'active' : ''}`} onClick={() => handleTabClick('only_cutting')} title="Only Cutting">
                  <Scissors size={18} />
                  <span className="sidebar-text">Only Cutting</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'approval_queue' ? 'active' : ''}`} onClick={() => handleTabClick('approval_queue')} style={{ position: 'relative' }} title="My Requests">
                  <Shield size={18} />
                  <span className="sidebar-text">My Requests</span>
                  {approvalRequests.filter(r => r.requesterName === currentUser?.name && r.status === 'pending').length > 0 && (
                    <span style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      backgroundColor: 'var(--warning)', color: '#fff', fontSize: '10px',
                      fontWeight: '800', padding: '2px 6px', borderRadius: '10px',
                      lineHeight: 1
                    }}>
                      {approvalRequests.filter(r => r.requesterName === currentUser?.name && r.status === 'pending').length}
                    </span>
                  )}
                </li>
              </>
            )}

            {/* STORE ROOM PANEL ITEMS (FLAT LIST) */}
            {currentUser?.role !== 'Admin' && getRolePanel(currentUser?.role) === 'store' && (
              <>
                <li className={`sidebar-item ${activeTab === 'weight_capture' ? 'active' : ''}`} onClick={() => handleTabClick('weight_capture')} title="Material Add (Scale)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                  <span className="sidebar-text">Material Add (Scale)</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'manually_weight_capture' ? 'active' : ''}`} onClick={() => handleTabClick('manually_weight_capture')} title="Manual Material Add">
                  <Layers size={18} />
                  <span className="sidebar-text">Manual Material Add</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'material_issue' ? 'active' : ''}`} onClick={() => handleTabClick('material_issue')} title="Material Issue">
                  <ClipboardList size={18} />
                  <span className="sidebar-text">Material Issue</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'bone_issue' || activeTab === 'bone_po' ? 'active' : ''}`} onClick={() => handleTabClick('bone_issue')} title="Bone Issue">
                  <Layers size={18} />
                  <span className="sidebar-text">Bone Issue</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'extra_material_issue' ? 'active' : ''}`} onClick={() => handleTabClick('extra_material_issue')} title="Extra Material Issue">
                  <Sparkles size={18} />
                  <span className="sidebar-text">Extra Material Issue</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'return_material' ? 'active' : ''}`} onClick={() => handleTabClick('return_material')} title="Return Material">
                  <RotateCcw size={18} />
                  <span className="sidebar-text">Return Material</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'material_details' ? 'active' : ''}`} onClick={() => handleTabClick('material_details')} title="Material Detail">
                  <Layers size={18} />
                  <span className="sidebar-text">Material Detail</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'material_transfer' ? 'active' : ''}`} onClick={() => handleTabClick('material_transfer')} title="Material Transfer">
                  <ArrowLeftRight size={18} />
                  <span className="sidebar-text">Material Transfer</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'warehouse_locations' ? 'active' : ''}`} onClick={() => handleTabClick('warehouse_locations')} title="Warehouse Locations">
                  <Layers size={18} />
                  <span className="sidebar-text">Warehouse Locations</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'rgp' ? 'active' : ''}`} onClick={() => handleTabClick('rgp')} title="Returnable Gate Pass">
                  <Truck size={18} />
                  <span className="sidebar-text">Returnable Gate Pass</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'generate_po' ? 'active' : ''}`} onClick={() => handleTabClick('generate_po')} title="Generate PO">
                  <FileText size={18} />
                  <span className="sidebar-text">Generate PO</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleTabClick('history')} title="Production Work">
                  <History size={18} />
                  <span className="sidebar-text">Production Work</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'scanner_logs' ? 'active' : ''}`} onClick={() => handleTabClick('scanner_logs')} title="Scanner Log">
                  <QrCode size={18} />
                  <span className="sidebar-text">Scanner Log</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'po_verification' ? 'active' : ''}`} onClick={() => handleTabClick('po_verification')} title="PO Verification">
                  <CheckCircle size={18} />
                  <span className="sidebar-text">PO Verification</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'only_cutting' ? 'active' : ''}`} onClick={() => handleTabClick('only_cutting')} title="Only Cutting">
                  <Scissors size={18} />
                  <span className="sidebar-text">Only Cutting</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'approval_queue' ? 'active' : ''}`} onClick={() => handleTabClick('approval_queue')} style={{ position: 'relative' }} title="My Requests">
                  <Shield size={18} />
                  <span className="sidebar-text">My Requests</span>
                  {approvalRequests.filter(r => r.requesterName === currentUser?.name && r.status === 'pending').length > 0 && (
                    <span style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      backgroundColor: 'var(--warning)', color: '#fff', fontSize: '10px',
                      fontWeight: '800', padding: '2px 6px', borderRadius: '10px',
                      lineHeight: 1
                    }}>
                      {approvalRequests.filter(r => r.requesterName === currentUser?.name && r.status === 'pending').length}
                    </span>
                  )}
                </li>
              </>
            )}

            {/* ADMIN-SPECIFIC GLOBAL ITEMS */}
            {currentUser?.role === 'Admin' && (
              <>
                <li className={`sidebar-item ${activeTab === 'reports_history' ? 'active' : ''}`} onClick={() => handleTabClick('reports_history')} title="Report and History">
                  <BarChart3 size={18} />
                  <span className="sidebar-text">Report and History</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => handleTabClick('settings')} title="Setting">
                  <SettingsIcon size={18} />
                  <span className="sidebar-text">Setting</span>
                </li>
                <li className={`sidebar-item ${activeTab === 're_download' ? 'active' : ''}`} onClick={() => handleTabClick('re_download')} title="Re-Download Options">
                  <Download size={18} />
                  <span className="sidebar-text">Re-Download Options</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleTabClick('history')} title="Production Work">
                  <History size={18} />
                  <span className="sidebar-text">Production Work</span>
                </li>
                <li className={`sidebar-item ${activeTab === 'approval_queue' ? 'active' : ''}`} onClick={() => handleTabClick('approval_queue')} style={{ position: 'relative' }} title="Approval Queue">
                  <Shield size={18} />
                  <span className="sidebar-text">Approval Queue</span>
                  {approvalRequests.filter(r => r.status === 'pending').length > 0 && (
                    <span className="sidebar-badge" style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      backgroundColor: 'var(--warning)', color: '#fff', fontSize: '10px',
                      fontWeight: '800', padding: '2px 6px', borderRadius: '10px',
                      lineHeight: 1
                    }}>
                      {approvalRequests.filter(r => r.status === 'pending').length}
                    </span>
                  )}
                </li>
              </>
            )}
          </ul>
        </nav>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            className="theme-toggle"
            style={{ width: '100%', borderRadius: 'var(--border-radius-md)', display: 'flex', gap: '8px', color: 'var(--sidebar-text, #334155)', backgroundColor: 'var(--bg-primary, #f0f7ff)', border: '1px solid var(--border-color, #dbeafe)' }}
            onClick={() => setIsDarkTheme(!isDarkTheme)}
            title={isDarkTheme ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDarkTheme ? <Sun size={18} /> : <Moon size={18} />}
            <span className="sidebar-text" style={{ fontSize: '13px', fontWeight: 'bold' }}>{isDarkTheme ? 'Light Theme' : 'Dark Theme'}</span>
          </button>
          <button
            className="theme-toggle"
            style={{ width: '100%', borderRadius: 'var(--border-radius-md)', display: 'flex', gap: '8px', color: '#ff4d4d', backgroundColor: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.2)' }}
            onClick={handleLogout}
            title="Sign Out"
          >
            <LogOut size={18} />
            <span className="sidebar-text" style={{ fontSize: '13px', fontWeight: 'bold' }}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-left-cluster" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
              aria-label="Toggle sidebar"
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={19} strokeWidth={2.2} /> : <PanelLeftClose size={19} strokeWidth={2.2} />}
            </button>
            <div className="header-title-container">
              <h1>
                {activeTab === 'dashboard' && 'Dashboard Overview'}
                {activeTab === 'design' && 'Below of Material'}
                {activeTab === 'material_verification' && 'Stock Accessories'}
                {activeTab === 'rgp' && 'Returnable Gate Pass'}
                {activeTab === 'zip_po' && 'Zip Purcharge Orders'}
                {activeTab === 'dori_po' && 'Dori Purcharge Orders'}
                {(activeTab === 'bone_issue' || activeTab === 'bone_po') && 'Bone Issue'}
                {activeTab === 'generate_po' && 'Generate PO'}
                {activeTab === 'history' && 'Production Work'}
                {activeTab === 'scanner_logs' && 'Scanner Log'}
                {activeTab === 'weight_capture' && 'Material Add (Scale Inward)'}
                {activeTab === 'manually_weight_capture' && 'Manual Material Inward Entry'}
                {activeTab === 'material_issue' && 'Material Issue'}
                {activeTab === 'extra_material_issue' && 'Extra Material Issue'}
                {activeTab === 'return_material' && 'Return Material'}
                {activeTab === 'material_details' && 'Material Detail'}
                {activeTab === 'material_transfer' && 'Material Transfer'}
                {activeTab === 'warehouse_locations' && 'Warehouse Locations'}
                {activeTab === 'reports_history' && 'Report and History'}
                {activeTab === 'settings' && 'Setting'}
                {activeTab === 'approval_queue' && (currentUser?.role === 'Admin' ? 'Approval Queue' : 'My Requests')}
                {activeTab === 'po_verification' && 'PO Verification'}
                {activeTab === 'only_cutting' && 'Only Cutting (Not Designed)'}
              </h1>
            </div>
          </div>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Notification Bell Icon */}
            <div style={{ position: 'relative' }}>
              <button
                className="theme-toggle"
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
                title="Notifications"
              >
                <Bell size={18} />
                {approvalRequests.filter(req => req.type === 'design_verification' && req.status === 'pending' && !dismissedNotifications.includes(req.id)).length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {approvalRequests.filter(req => req.type === 'design_verification' && req.status === 'pending' && !dismissedNotifications.includes(req.id)).length}
                  </span>
                )}
              </button>

              {showNotificationsDropdown && (
                <div
                  className="panel"
                  style={{
                    position: 'absolute',
                    top: '46px',
                    right: 0,
                    width: '320px',
                    maxHeight: '360px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: 'var(--shadow-lg)',
                    border: '1.5px solid var(--border-color)',
                    padding: '12px',
                    backgroundColor: 'var(--bg-primary)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-main)' }}>Notifications</span>
                    <button
                      style={{ fontSize: '11px', color: 'var(--accent-color)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                      onClick={() => setShowNotificationsDropdown(false)}
                    >
                      Close
                    </button>
                  </div>

                  {(() => {
                    const pendingVerifications = approvalRequests.filter(req =>
                      req.type === 'design_verification' &&
                      req.status === 'pending' &&
                      !dismissedNotifications.includes(req.id)
                    );
                    if (pendingVerifications.length === 0) {
                      return (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                          No pending design verifications.
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {pendingVerifications.map(req => (
                          <div
                            key={req.id}
                            onClick={() => {
                              if (currentUser.role === 'Admin') {
                                setActiveTab('approval_queue');
                              }
                              setShowNotificationsDropdown(false);
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 'var(--border-radius-sm)',
                              backgroundColor: 'var(--bg-secondary)',
                              borderLeft: '3.5px solid var(--accent-color)',
                              cursor: currentUser.role === 'Admin' ? 'pointer' : 'default',
                              textAlign: 'left',
                              position: 'relative'
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDismissedNotifications(prev => [...prev, req.id]);
                              }}
                              style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                transition: 'background-color 0.2s'
                              }}
                              title="Dismiss notification"
                            >
                              <X size={12} />
                            </button>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)', paddingRight: '20px' }}>
                              {req.requesterName} created a design
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', paddingRight: '20px' }}>
                              Please verify design Lot No: {req.lotId}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                              {req.date}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="user-profile">
              {/* Dynamic avatar representation */}
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-color)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontFamily: 'var(--font-family-title)'
              }}>
                {getInitials(currentUser.name)}
              </div>
              <div className="user-info">
                <span className="user-name">{currentUser.name}</span>
                <span className="user-role">{currentUser.role}</span>
              </div>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Sign Out"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="page-container">
          <Suspense fallback={
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              color: 'var(--text-muted, #64748b)'
            }}>
              <div className="spinner" style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(99, 102, 241, 0.2)',
                borderTopColor: 'var(--accent-color, #6366f1)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginBottom: '14px'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Loading module...</span>
            </div>
          }>
            {activeTab === 'dashboard' && (
              <DashboardView
                stats={getStats()}
                transactions={getTransactions()}
                designs={designs}
                onNavigate={setActiveTab}
                onOpenNewDesignModal={() => setIsNewDesignModalOpen(true)}
                currencySymbol={currencySymbol}
                role={currentUser?.role}
              />
            )}

            {activeTab === 'design' && (
              <DesignView
                designs={designs}
                materials={materials}
                onAddDesign={handleAddDesign}
                currencySymbol={currencySymbol}
                accessoriesList={accessoriesList}
                designersList={designersList}
                onRedirectToTab={handleRedirectToTab}
                prefilledLotNo={prefilledLotNo}
                setPrefilledLotNo={setPrefilledLotNo}
              />
            )}

            {activeTab === 'material_verification' && (
              <MaterialVerificationView
                designs={designs}
                materials={materials}
                vendors={vendors}
                currencySymbol={currencySymbol}
                currentUser={currentUser}
                onRedirectToTab={handleRedirectToTab}
                onRedirectToZipPO={handleRedirectToZipPO}
                onRedirectToPO={handleRedirectToPO}
                onRedirectToRGP={handleRedirectToRGP}
              />
            )}

            {activeTab === 'material_issue' && (
              <MaterialIssueView
                designs={designs}
                materials={materials}
                onIssueMaterials={handleIssueMaterials}
                onReturnMaterials={handleReturnMaterials}
                issueLogs={issueLogs}
                currencySymbol={currencySymbol}
                currentUser={currentUser}
                onSubmitApproval={handleSubmitApprovalRequest}
                onRedirectToZipPO={handleRedirectToZipPO}
              />
            )}

            {activeTab === 'extra_material_issue' && (
              <ExtraMaterialIssueView
                designs={designs}
                materials={materials}
                onIssueMaterials={handleIssueMaterials}
                issueLogs={issueLogs}
                currencySymbol={currencySymbol}
                currentUser={currentUser}
                onSubmitApproval={handleSubmitApprovalRequest}
              />
            )}

            {activeTab === 'return_material' && (
              <ReturnMaterialView
                designs={designs}
                materials={materials}
                onReturnMaterials={handleReturnMaterials}
                issueLogs={issueLogs}
                currencySymbol={currencySymbol}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'generate_po' && (
              <GeneratePOView
                designs={designs}
                vendors={vendors}
                pos={pos}
                onAddPO={handleAddPO}
                currencySymbol={currencySymbol}
                prefilledPoData={prefilledPoData}
                setPrefilledPoData={setPrefilledPoData}
                materials={materials}
              />
            )}

            {activeTab === 're_download' && (
              <ReDownloadView
                currencySymbol={currencySymbol}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'zip_po' && (
              <PuneetZip prefilledLotNo={prefilledLotNo} setPrefilledLotNo={setPrefilledLotNo} initialTab="zip" />
            )}

            {activeTab === 'dori_po' && (
              <PuneetZip prefilledLotNo={prefilledLotNo} setPrefilledLotNo={setPrefilledLotNo} initialTab="dori" />
            )}

            {(activeTab === 'bone_issue' || activeTab === 'bone_po') && (
              <BoneIssueView
                prefilledLotNo={prefilledLotNo}
                setPrefilledLotNo={setPrefilledLotNo}
                currentUser={currentUser}
                currencySymbol={currencySymbol}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'material_details' && (
              <MaterialDetailsView
                materials={materials}
                onAddMaterial={handleAddMaterial}
                onDeleteMaterial={handleDeleteMaterial}
                onUpdateMaterial={handleUpdateMaterial}
                currencySymbol={currencySymbol}
                currentUser={currentUser}
                onSubmitApproval={handleSubmitApprovalRequest}
                allowMaterialPhotoEdit={allowMaterialPhotoEdit}
              />
            )}

            {activeTab === 'reports_history' && (
              <ReportsHistoryView
                pos={pos}
                designs={designs}
                issueLogs={issueLogs}
                currencySymbol={currencySymbol}
              />
            )}

            {activeTab === 'only_cutting' && (
              <OnlyCutting
                currentUser={currentUser}
                role={currentUser?.role}
                onNavigateToDesign={(lotNo) => {
                  setPrefilledLotNo(lotNo);
                  setActiveTab('design');
                }}
                onNavigateToZipPO={(lotNo) => handleRedirectToZipPO(lotNo, 'zip')}
                onNavigateToDoriPO={(lotNo) => handleRedirectToZipPO(lotNo, 'dori')}
                onNavigateToBonePO={(lotNo) => handleRedirectToZipPO(lotNo, 'bone')}
                onNavigateToMaterialIssue={(lotNo) => {
                  setPrefilledLotNo(lotNo);
                  setActiveTab('material_issue');
                }}
                onNavigateToStockAccessories={(lotNo) => {
                  setPrefilledLotNo(lotNo);
                  setActiveTab('material_verification');
                }}
                onRedirectToTab={handleRedirectToTab}
              />
            )}

            {activeTab === 'settings' && currentUser?.role === 'Admin' && (
              <SettingsView
                vendors={vendors}
                onAddVendor={handleAddVendor}
                onDeleteVendor={handleDeleteVendor}
                currencySymbol={currencySymbol}
                setCurrencySymbol={setCurrencySymbol}
                defaultTax={defaultTax}
                setDefaultTax={setDefaultTax}
                onResetDatabase={handleResetDatabase}
                accessoriesList={accessoriesList}
                onAddAccessory={handleAddAccessory}
                onDeleteAccessory={handleDeleteAccessory}
                designersList={designersList}
                onAddDesigner={handleAddDesigner}
                onDeleteDesigner={handleDeleteDesigner}
                materials={materials}
                onAddMaterial={handleAddMaterial}
                onDeleteMaterial={handleDeleteMaterial}
                onUpdateMaterial={handleUpdateMaterial}
                racks={racks}
                setRacks={setRacks}
                halls={halls}
                setHalls={setHalls}
                allowMaterialPhotoEdit={allowMaterialPhotoEdit}
                onToggleAllowMaterialPhotoEdit={handleToggleAllowMaterialPhotoEdit}
                allowWarehouseAddRack={allowWarehouseAddRack}
                onToggleAllowWarehouseAddRack={handleToggleAllowWarehouseAddRack}
              />
            )}

            {activeTab === 'approval_queue' && currentUser && (
              <ApprovalQueueView
                approvalRequests={approvalRequests}
                onApprove={handleApproveRequest}
                onReject={handleRejectRequest}
                materials={materials}
                designs={designs}
                currencySymbol={currencySymbol}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'history' && currentUser && (
              <HistoryView
                designs={designs}
                currencySymbol={currencySymbol}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'scanner_logs' && currentUser && (
              <ScannerLogsView currencySymbol={currencySymbol} />
            )}

            {activeTab === 'rgp' && currentUser && (
              <FabricRgpForm
                onSubmit={(payload) => console.log('RGP submitted:', payload)}
                onBack={() => setActiveTab('dashboard')}
                prefilledRgpData={prefilledRgpData}
                setPrefilledRgpData={setPrefilledRgpData}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'weight_capture' && currentUser && (
              <WeightCapture racks={racks} currentUser={currentUser} />
            )}

            {activeTab === 'manually_weight_capture' && currentUser && (
              <ManuallyWeightCapture racks={racks} currentUser={currentUser} />
            )}

            {activeTab === 'material_transfer' && currentUser && (
              <MaterialTransferView currentUser={currentUser} />
            )}

            {activeTab === 'warehouse_locations' && (
              <WarehouseLocationView
                racks={racks}
                materials={materials}
                halls={halls}
                onNavigate={setActiveTab}
                currentUser={currentUser}
                allowWarehouseAddRack={allowWarehouseAddRack}
              />
            )}

            {activeTab === 'po_verification' && (
              <POVerificationView currencySymbol={currencySymbol} currentUser={currentUser} />
            )}
          </Suspense>
        </div>
      </main>

      {/* Modal Dialog for quick new Design Requests */}
      {isNewDesignModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-lg animate-scale" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Design Request</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsNewDesignModalOpen(false)}>Cancel</button>
            </div>

            <form onSubmit={handleCreateDesignFromModal}>
              {/* Auto Lot No Preview and override input */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                backgroundColor: 'var(--accent-light)',
                border: '1.5px solid var(--accent-color)',
                borderRadius: 'var(--border-radius-md)',
                padding: '14px 18px',
                marginBottom: '20px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '100px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Auto Lot No</span>
                  <span style={{ fontFamily: 'var(--font-family-title)', fontSize: '24px', fontWeight: '800', color: 'var(--accent-color)', lineHeight: 1.2 }}>
                    {(() => {
                      const ids = designs.map(d => parseInt(d.id, 10)).filter(id => !isNaN(id) && id >= 30000 && id < 60000);
                      const maxId = ids.length > 0 ? Math.max(...ids) : 0;
                      return maxId >= 30000 ? maxId + 1 : 30000;
                    })()}
                  </span>
                </div>
                <div style={{ borderLeft: '1px solid var(--accent-color)', paddingLeft: '16px', flex: '1 1 180px' }}>
                  <label className="form-label" style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: 'bold', marginBottom: '2px' }}>Override Lot Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter custom Lot No (e.g. MH-4458)"
                    value={mLotNo}
                    onChange={(e) => setMLotNo(e.target.value)}
                    style={{ height: '34px', fontSize: '13px', padding: '4px 8px' }}
                  />
                </div>
                <div style={{ borderLeft: '1px solid var(--accent-color)', paddingLeft: '16px', flex: '1 1 200px' }}>
                  <label className="form-label" style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: 'bold', marginBottom: '2px' }}>Autofill from Synced Sheet</label>
                  <select
                    className="form-input"
                    value=""
                    onChange={(e) => handleModalAutofillFromLot(e.target.value)}
                    style={{ height: '34px', fontSize: '13px', padding: '4px 8px', cursor: 'pointer' }}
                  >
                    <option value="" disabled>-- Select Lot Batch --</option>
                    {syncedLots.map((s) => (
                      <option key={s.lotNo} value={s.lotNo}>
                        {s.lotNo} - {s.itemName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Lot No 2 (Secondary)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. LOT-MH-B"
                    value={mLotNo2}
                    onChange={(e) => setMLotNo2(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Brand / Client</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Zara, Nike, custom"
                    value={mBrand}
                    onChange={(e) => setMBrand(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Garment Style Category</label>
                  <select
                    className="form-input"
                    value={mCategory}
                    onChange={(e) => setMCategory(e.target.value)}
                  >
                    {GARMENT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Style Code / Code Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ST-9921"
                    value={mStyle}
                    onChange={(e) => setMStyle(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Section / Target Aud.</label>
                  <select
                    className="form-input"
                    value={mSection}
                    onChange={(e) => setMSection(e.target.value)}
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
                  <label className="form-label">Season</label>
                  <select
                    className="form-input"
                    value={mSeason}
                    onChange={(e) => setMSeason(e.target.value)}
                  >
                    <option value="Summer">Summer</option>
                    <option value="Winter">Winter</option>
                  </select>
                </div>
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Fabric Specification</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 100% Wool, Cotton Fleece"
                    value={mFabric}
                    onChange={(e) => setMFabric(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Order Quantity (Pieces)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    placeholder="e.g. 500"
                    value={mQuantity}
                    onChange={(e) => setMQuantity(Number(e.target.value) || 100)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Design Image URL (Auto-fetched or Manual)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Google Drive link or direct image link"
                  value={mImageUrl}
                  onChange={(e) => setMImageUrl(e.target.value)}
                />
              </div>

              {mImageUrl && (
                <div style={{
                  marginBottom: '16px',
                  borderRadius: 'var(--border-radius-md)',
                  border: '1.5px solid var(--border-color)',
                  overflow: 'hidden',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '140px',
                  padding: '8px'
                }}>
                  <img
                    src={getCleanImageUrl(mImageUrl)}
                    alt="Quick Design Preview"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsNewDesignModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Tech Pack Base</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmResetOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} style={{ color: 'var(--danger-color, #ef4444)' }} />
                <span>Restore Mock Data</span>
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConfirmResetOpen(false)}
                style={{ padding: '4px 8px' }}
              >
                Close
              </button>
            </div>
            <div style={{ margin: '16px 0', fontSize: '14px', lineHeight: '1.5', color: 'var(--text-color)' }}>
              Are you sure you want to restore all mock data? All custom progress and data changes will be permanently deleted.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmResetOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setConfirmResetOpen(false);
                  executeResetDatabase();
                }}
              >
                Restore Mock Data
              </button>
            </div>
          </div>
        </div>
      )}

      {customAlert !== null && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content animate-scale" style={{ maxWidth: '400px', textAlign: 'center', padding: '36px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {(() => {
                let type = 'info';
                let cleanMessage = customAlert || '';

                if (cleanMessage.includes('✅') || cleanMessage.toLowerCase().includes('success') || cleanMessage.toLowerCase().includes('downloaded')) {
                  type = 'success';
                  cleanMessage = cleanMessage.replace('✅', '').trim();
                } else if (cleanMessage.includes('❌') || cleanMessage.toLowerCase().includes('error') || cleanMessage.toLowerCase().includes('fail')) {
                  type = 'error';
                  cleanMessage = cleanMessage.replace('❌', '').trim();
                } else if (cleanMessage.toLowerCase().includes('required') || cleanMessage.toLowerCase().includes('please enter') || cleanMessage.toLowerCase().includes('valid')) {
                  type = 'warning';
                }

                const lines = cleanMessage.split('\n');

                const getIcon = () => {
                  switch (type) {
                    case 'success':
                      return <CheckCircle size={48} style={{ color: 'var(--success, #10b981)', marginBottom: '16px' }} />;
                    case 'error':
                      return <AlertTriangle size={48} style={{ color: 'var(--danger, #ef4444)', marginBottom: '16px' }} />;
                    case 'warning':
                      return <AlertTriangle size={48} style={{ color: 'var(--warning, #f59e0b)', marginBottom: '16px' }} />;
                    default:
                      return <CheckSquare size={48} style={{ color: 'var(--accent-color, #3b82f6)', marginBottom: '16px' }} />;
                  }
                };

                const getHeaderColor = () => {
                  switch (type) {
                    case 'success': return 'var(--success, #10b981)';
                    case 'error': return 'var(--danger, #ef4444)';
                    case 'warning': return 'var(--warning, #f59e0b)';
                    default: return 'var(--accent-color, #3b82f6)';
                  }
                };

                return (
                  <>
                    {getIcon()}
                    <h3 style={{
                      fontFamily: 'var(--font-family-title)',
                      fontSize: '20px',
                      fontWeight: '800',
                      color: getHeaderColor(),
                      marginBottom: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Alert' : 'Notification'}
                    </h3>
                    <div style={{
                      fontSize: '14.5px',
                      color: 'var(--text-main)',
                      lineHeight: '1.6',
                      marginBottom: '24px',
                      fontWeight: '500',
                      textAlign: 'center'
                    }}>
                      {lines.map((line, idx) => (
                        <p key={idx} style={{ margin: '4px 0' }}>{line}</p>
                      ))}
                    </div>
                  </>
                );
              })()}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCustomAlert(null)}
                style={{
                  minWidth: '120px',
                  borderRadius: '20px',
                  padding: '10px 24px',
                  boxShadow: 'var(--shadow-md)',
                  fontSize: '14px',
                  fontWeight: '700'
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

