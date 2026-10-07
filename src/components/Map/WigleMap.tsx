import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { ProcessedAccessPoint } from '../../types/wigle';
import { calculateTriangulation } from '../../utils/triangulation';
import {
  Layers,
  MapPin,
  Compass,
  Radio,
  Wifi,
  Lock,
  Unlock,
  Filter,
  RotateCcw,
  Search,
  X,
  Info,
  SlidersHorizontal,
  Eye,
  Crosshair,
  ArrowUpDown,
  Target,
  History,
  Calendar,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { analyzeNetworkHistory } from '../../utils/historyUtils';
import { NetworkHistoryModal } from '../NetworkList/NetworkHistoryModal';
import { getWigleSignalTier } from '../../utils/wigleSignalColors';
import { formatToEuropeanDate } from '../../utils/statsUtils';

export type DrawerSortOption =
  | 'SSID'
  | 'MAC'
  | 'VENDOR'
  | 'SECURITY'
  | 'SIGNAL'
  | 'CHANNEL'
  | 'FIRST_SEEN';

interface WigleMapProps {
  accessPoints: ProcessedAccessPoint[];
  selectedAp: ProcessedAccessPoint | null;
  onSelectAp: (ap: ProcessedAccessPoint) => void;
  onInspectAp?: (ap: ProcessedAccessPoint) => void;
  activeLocationFilter: { lat: number; lng: number; key: string; radiusMeters?: number; macs?: string[] } | null;
  onFilterByLocation: (location: { lat: number; lng: number; key: string; radiusMeters?: number; macs?: string[] } | null) => void;
  isWigleDevice?: boolean;
  totalGpsPointsCount?: number;
  onResetFilters?: () => void;
  isOnlyModifiedFilterActive?: boolean;
}

// Extend Leaflet Canvas 2D renderer prototype to draw network count numbers and selection halos directly on Canvas
if (typeof window !== 'undefined' && L && L.Canvas) {
  const canvasProto = (L.Canvas as any).prototype;
  if (canvasProto && !canvasProto._wigleCanvasPatched) {
    canvasProto._wigleCanvasPatched = true;

    // Safety: ensure this._ctx is initialized whenever container exists
    const origInitContainer = canvasProto._initContainer;
    canvasProto._initContainer = function () {
      try {
        origInitContainer.call(this);
      } catch (e) {}
      if (this._container && !this._ctx) {
        try {
          this._ctx = this._container.getContext('2d');
        } catch (e) {}
      }
    };

    // Safety: guard _draw against undefined _ctx
    const origDraw = canvasProto._draw;
    canvasProto._draw = function () {
      if (!this._ctx && this._container) {
        try {
          this._ctx = this._container.getContext('2d');
        } catch (e) {}
      }
      if (!this._ctx || typeof this._ctx.save !== 'function') {
        return;
      }
      try {
        origDraw.call(this);
      } catch (e) {}
    };

    // Safety: guard _clear against undefined _ctx
    const origClear = canvasProto._clear;
    canvasProto._clear = function () {
      if (!this._ctx && this._container) {
        try {
          this._ctx = this._container.getContext('2d');
        } catch (e) {}
      }
      if (!this._ctx || typeof this._ctx.clearRect !== 'function') {
        return;
      }
      try {
        origClear.call(this);
      } catch (e) {}
    };

    // Safety: guard _updatePath against undefined _ctx
    const origUpdatePath = canvasProto._updatePath;
    canvasProto._updatePath = function (layer: any) {
      if (!this._ctx && this._container) {
        try {
          this._ctx = this._container.getContext('2d');
        } catch (e) {}
      }
      if (!this._ctx || typeof this._ctx.save !== 'function' || !this._drawing) {
        return;
      }
      try {
        origUpdatePath.call(this, layer);
      } catch (e) {}
    };

    // Safety: guard _updatePoly against undefined _ctx
    const origUpdatePoly = canvasProto._updatePoly;
    canvasProto._updatePoly = function (layer: any, closed: any) {
      if (!this._ctx && this._container) {
        try {
          this._ctx = this._container.getContext('2d');
        } catch (e) {}
      }
      if (!this._ctx || typeof this._ctx.save !== 'function' || !this._drawing) {
        return;
      }
      try {
        origUpdatePoly.call(this, layer, closed);
      } catch (e) {}
    };

    // Safety & text rendering: _updateCircle
    const origUpdateCircle = canvasProto._updateCircle;
    canvasProto._updateCircle = function (layer: any) {
      if (!this._ctx && this._container) {
        try {
          this._ctx = this._container.getContext('2d');
        } catch (e) {}
      }
      if (!this._ctx || typeof this._ctx.save !== 'function' || !this._drawing || !layer || !layer._point || (layer._empty && layer._empty())) {
        return;
      }
      try {
        origUpdateCircle.call(this, layer);
      } catch (e) {
        return;
      }
      if (!this._drawing || !this._ctx || !layer.options) return;
      const p = layer._point;
      if (!p) return;
      const ctx = this._ctx;
      if (!ctx || typeof ctx.save !== 'function') return;
      const r = Math.max(Math.round(layer._radius || 1), 1);

      // If marker is highlighted/selected, draw an outer cyan glow ring
      if (layer.options.isHighlighted) {
        try {
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 3.5, 0, Math.PI * 2, false);
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 3.5;
          ctx.stroke();
          ctx.restore();
        } catch (e) {}
      }

      // Draw the network count text centered inside the circle directly on Canvas 2D
      if (layer.options.text !== undefined && layer.options.text !== null && layer.options.text !== '') {
        try {
          ctx.save();
          let displayTxt = String(layer.options.text);
          const num = Number(layer.options.text);
          if (!isNaN(num) && num >= 1000) {
            displayTxt = num >= 10000 ? `${Math.round(num / 1000)}k` : `${(num / 1000).toFixed(1)}k`;
          }
          ctx.font =
            layer.options.font ||
            (num >= 1000
              ? '800 8.5px ui-monospace, SFMono-Regular, monospace'
              : num >= 100
              ? '800 9px ui-monospace, SFMono-Regular, monospace'
              : '800 10px ui-monospace, SFMono-Regular, monospace');
          ctx.fillStyle = layer.options.textColor || '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(displayTxt, p.x, p.y);
          ctx.restore();
        } catch (e) {}
      }
    };

    const origFillStroke = canvasProto._fillStroke;
    canvasProto._fillStroke = function (ctx: any, layer: any) {
      const targetCtx = ctx || this._ctx;
      if (!targetCtx || typeof targetCtx.save !== 'function') return;
      try {
        origFillStroke.call(this, targetCtx, layer);
      } catch (e) {}
    };
  }
}

// 100% Free OpenStreetMap & Open Tile Layers (No API Key Required)
const TILE_LAYERS = {
  osm_standard: {
    name: 'OpenStreetMap Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: undefined,
  },
  osm_humanitarian: {
    name: 'OSM Humanitarian (HOT)',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by Humanitarian OpenStreetMap Team',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
  opentopo: {
    name: 'OpenTopoMap (Topography)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
    subdomains: ['a', 'b', 'c'],
  },
  cyclosm: {
    name: 'CyclOSM (Cycling & Terrain)',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, CyclOSM',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
  esri_satellite: {
    name: 'Esri Satellite Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
    maxZoom: 18,
    subdomains: undefined,
  },
  esri_topo: {
    name: 'Esri World Topo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey',
    maxZoom: 18,
    subdomains: undefined,
  },
};

export interface LocationPointGroup {
  key: string;
  latitude: number;
  longitude: number;
  networks: ProcessedAccessPoint[];
  count: number;
}

type DrawerMode = 'NONE' | 'POINT_DETAILS' | 'VIEWPORT_FILTER';

export const WigleMap: React.FC<WigleMapProps> = ({
  accessPoints,
  selectedAp,
  onSelectAp,
  onInspectAp,
  activeLocationFilter,
  onFilterByLocation,
  isWigleDevice = false,
  totalGpsPointsCount = 0,
  onResetFilters,
  isOnlyModifiedFilterActive = false,
}) => {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const triangulationLayerRef = useRef<L.LayerGroup | null>(null);

  const [currentTile, setCurrentTile] = useState<keyof typeof TILE_LAYERS>('osm_standard');
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [isTriangulationMode, setIsTriangulationMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wigle_triangulation_mode');
      if (saved !== null) return saved === 'true';
    } catch (e) {
      // ignore
    }
    return true;
  });

  // Track if triangulation mode was originally disabled before clicking a network in lateral drawer
  const wasTriModeOriginallyDisabledRef = useRef<boolean>(false);
  // Ref for the scrollable AP list in lateral drawer to keep scroll at top on point change
  const drawerListRef = useRef<HTMLDivElement>(null);

  const handleToggleTriangulationMode = () => {
    // When user explicitly clicks the triangulation toggle, reset temporary mode flag
    wasTriModeOriginallyDisabledRef.current = false;
    setIsTriangulationMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('wigle_triangulation_mode', String(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  const handleCloseDrawer = useCallback(() => {
    setDrawerMode('NONE');
    setActiveGroup(null);
    onSelectAp(null as any);
    if (triangulationLayerRef.current) {
      triangulationLayerRef.current.clearLayers();
    }
    // If triangulation mode was temporarily activated from clicking a network in drawer, revert it
    if (wasTriModeOriginallyDisabledRef.current) {
      setIsTriangulationMode(false);
      wasTriModeOriginallyDisabledRef.current = false;
    }
  }, [onSelectAp]);

  // Track previous selected AP mac to avoid resetting map view on other state changes
  const prevSelectedMacRef = useRef<string | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);

  // Track map zoom level to dynamically scale clustering so circles never overlap or stomp on each other
  const [currentZoom, setCurrentZoom] = useState<number>(15);

  // History Modal state for lateral drawer
  const [historyModalAp, setHistoryModalAp] = useState<ProcessedAccessPoint | null>(null);
  const [historyModalType, setHistoryModalType] = useState<'SSID' | 'SECURITY'>('SSID');

  // Side Drawer state for Grouped Points and Viewport Filter
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('NONE');
  const [activeGroup, setActiveGroup] = useState<LocationPointGroup | null>(null);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [drawerSecurityFilter, setDrawerSecurityFilter] = useState<string>('ALL');
  const [viewportBounds, setViewportBounds] = useState<L.LatLngBounds | null>(null);
  const [highlightedMac, setHighlightedMac] = useState<string | null>(null);
  const [hoveredApMac, setHoveredApMac] = useState<string | null>(null);

  // Sorting state for lateral drawer (persisted in localStorage, default: SSID)
  const [drawerSort, setDrawerSort] = useState<DrawerSortOption>(() => {
    try {
      const saved = localStorage.getItem('wigle_drawer_sort');
      if (saved && ['SSID', 'MAC', 'VENDOR', 'SECURITY', 'SIGNAL', 'CHANNEL', 'FIRST_SEEN'].includes(saved)) {
        return saved as DrawerSortOption;
      }
    } catch (e) {
      // Ignore storage errors
    }
    return 'SSID';
  });

  const handleDrawerSortChange = (newSort: DrawerSortOption) => {
    setDrawerSort(newSort);
    try {
      localStorage.setItem('wigle_drawer_sort', newSort);
    } catch (e) {
      // Ignore storage errors
    }
  };

  // Guarantee that when opening a new point group or changing drawer mode, the list starts at the top
  useEffect(() => {
    if (drawerListRef.current) {
      drawerListRef.current.scrollTop = 0;
    }
  }, [activeGroup?.key, drawerMode]);

  // Group APs strictly and stably by GPS location (~15m grid) - completely independent of zoom level so counts never change or mismatch with drawer
  const locationGroups = useMemo(() => {
    if (accessPoints.length === 0) return [];

    const validAps = accessPoints.filter((ap) => ap.latitude !== 0 && ap.longitude !== 0);
    if (validAps.length === 0) return [];

    const mergeDistMeters = 15;
    const centerLat = validAps[0].latitude;
    const cosLat = Math.cos((centerLat * Math.PI) / 180);
    const cellLat = mergeDistMeters / 111320;
    const cellLng = mergeDistMeters / (111320 * Math.max(0.1, cosLat));

    interface Cluster {
      key: string;
      latSum: number;
      lngSum: number;
      latitude: number;
      longitude: number;
      networks: ProcessedAccessPoint[];
    }

    const grid = new Map<string, Cluster[]>();
    const clusters: Cluster[] = [];

    const getDistMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const dLat = (lat2 - lat1) * 111320;
      const dLon = (lon2 - lon1) * 111320 * cosLat;
      return Math.sqrt(dLat * dLat + dLon * dLon);
    };

    validAps.forEach((ap) => {
      const gx = Math.floor(ap.latitude / cellLat);
      const gy = Math.floor(ap.longitude / cellLng);

      let closest: Cluster | null = null;
      let minD = mergeDistMeters;

      // Check current and 8 neighbor cells
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const list = grid.get(`${gx + dx}:${gy + dy}`);
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const c = list[i];
            const d = getDistMeters(ap.latitude, ap.longitude, c.latitude, c.longitude);
            if (d < minD) {
              minD = d;
              closest = c;
            }
          }
        }
      }

      if (closest) {
        closest.networks.push(ap);
        closest.latSum += ap.latitude;
        closest.lngSum += ap.longitude;
        closest.latitude = closest.latSum / closest.networks.length;
        closest.longitude = closest.lngSum / closest.networks.length;
      } else {
        const newC: Cluster = {
          key: `${ap.latitude.toFixed(5)},${ap.longitude.toFixed(5)}`,
          latSum: ap.latitude,
          lngSum: ap.longitude,
          latitude: ap.latitude,
          longitude: ap.longitude,
          networks: [ap],
        };
        clusters.push(newC);
        const cellKey = `${gx}:${gy}`;
        const existing = grid.get(cellKey);
        if (existing) {
          existing.push(newC);
        } else {
          grid.set(cellKey, [newC]);
        }
      }
    });

    return clusters.map((c) => ({
      key: c.key,
      latitude: c.latitude,
      longitude: c.longitude,
      networks: c.networks,
      count: c.networks.length,
    }));
  }, [accessPoints]);

  // Total valid GPS points
  const totalGpsApsCount = useMemo(() => {
    return accessPoints.filter((a) => a.latitude !== 0 && a.longitude !== 0).length;
  }, [accessPoints]);

  // Color helper based on number of networks detected at the location (extended tiers up to 1000+)
  const getLocationColor = (count: number): string => {
    if (count >= 1000) return '#0f172a'; // Deep Slate / Obsidian (1000+)
    if (count >= 500) return '#581c87'; // Deep Royal Violet (500+)
    if (count >= 100) return '#1e1b4b'; // Deep Midnight Black / Obsidian (100+) - highly distinct from red
    if (count >= 50) return '#9333ea'; // Purple (50-99)
    if (count >= 25) return '#ef4444'; // Vivid Red (25-49)
    if (count >= 10) return '#f97316'; // Orange (10-24)
    if (count >= 5) return '#eab308'; // Amber / Gold (5-9)
    if (count >= 2) return '#10b981'; // Emerald Green (2-4)
    return '#0284c7'; // Sky Blue for single AP (1)
  };

  // Radius scaled gracefully for sleek display
  const getLocationRadius = (count: number): number => {
    if (count >= 1000) return 16;
    if (count >= 500) return 15;
    if (count >= 100) return 13;
    if (count >= 50) return 12;
    if (count >= 10) return 11;
    if (count >= 5) return 10;
    return 9;
  };

  // Update current viewport bounds
  const updateMapBounds = useCallback(() => {
    if (!mapInstanceRef.current) return;
    setViewportBounds(mapInstanceRef.current.getBounds());
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = locationGroups.length > 0 ? locationGroups[0].latitude : 45.7309;
    const initialLng = locationGroups.length > 0 ? locationGroups[0].longitude : 4.7437;

    const canvasRenderer = L.canvas({ padding: 0.25 });
    canvasRendererRef.current = canvasRenderer;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false,
      preferCanvas: true,
      renderer: canvasRenderer,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const tileCfg = TILE_LAYERS[currentTile];
    const baseTile = L.tileLayer(tileCfg.url, {
      attribution: tileCfg.attribution,
      maxZoom: 19,
      maxNativeZoom: tileCfg.maxZoom,
      subdomains: tileCfg.subdomains || 'abc',
      keepBuffer: 4,
      updateWhenIdle: true,
      updateWhenZooming: false,
    }).addTo(map);

    tileLayerRef.current = baseTile;
    markersLayerRef.current = L.layerGroup().addTo(map);
    triangulationLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Debounced move/zoom event listener for ultra-fluid 60 FPS zooming and dezooming without UI freezing
    let updateTimer: ReturnType<typeof setTimeout> | null = null;
    const handleMapStateChange = () => {
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        if (!mapInstanceRef.current) return;
        requestAnimationFrame(() => {
          if (!mapInstanceRef.current) return;
          updateMapBounds();
          setCurrentZoom(mapInstanceRef.current.getZoom());
        });
      }, 70);
    };

    map.on('moveend', handleMapStateChange);
    map.on('zoomend', handleMapStateChange);

    // Invalidate size once initial render completes to ensure all tiles load without gray voids
    setTimeout(() => {
      map.invalidateSize({ pan: false });
      updateMapBounds();
      setCurrentZoom(map.getZoom());
    }, 100);

    const container = mapContainerRef.current;
    const handleContainerWheel = (e: WheelEvent) => {
      // Prevent wheel events from causing window/page scrolling when zooming or wheeling over the map
      e.preventDefault();
      e.stopPropagation();
    };
    if (container) {
      container.addEventListener('wheel', handleContainerWheel, { passive: false });
    }

    // ResizeObserver dynamically eliminates grey tiles whenever the container resizes
    let resizeObserver: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ pan: false });
        }
      });
      resizeObserver.observe(container);
    }

    const handleWindowResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ pan: false });
      }
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      if (updateTimer) {
        clearTimeout(updateTimer);
      }
      window.removeEventListener('resize', handleWindowResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (container) {
        container.removeEventListener('wheel', handleContainerWheel);
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update base tile layer when currentTile changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const cfg = TILE_LAYERS[currentTile];
    tileLayerRef.current.setUrl(cfg.url);
    tileLayerRef.current.options.maxNativeZoom = cfg.maxZoom;
  }, [currentTile]);

  // Keep map tiles valid when drawer toggles
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize({ pan: false });
    }, 150);
    return () => clearTimeout(timer);
  }, [drawerMode]);

  // Center map on access point taking lateral drawer into account (optimized centering and smooth pan without grey tiles)
  const centerOnAp = useCallback(
    (ap: ProcessedAccessPoint, zoom: number = 18, forcedDrawerOpen?: boolean) => {
      const map = mapInstanceRef.current;
      if (!map || (ap.latitude === 0 && ap.longitude === 0)) return;

      const tileCfg = TILE_LAYERS[currentTile];
      // Target zoom clamped to provider's maxZoom to avoid grey missing tiles
      const targetZoom = Math.min(zoom, tileCfg.maxZoom);
      const isDrawerOpen = forcedDrawerOpen !== undefined ? forcedDrawerOpen : drawerMode !== 'NONE';

      let targetCenter: L.LatLngExpression = [ap.latitude, ap.longitude];

      if (isDrawerOpen) {
        // Measure real container width to calculate exact drawer offset
        const containerWidth = mapContainerRef.current?.clientWidth || window.innerWidth;
        const drawerWidth = containerWidth >= 1024 ? 500 : containerWidth >= 640 ? 460 : Math.min(340, containerWidth * 0.88);
        // Shift map center to the right by (drawerWidth / 2) so AP is centered in the visible remaining map space
        const targetPoint = map.project([ap.latitude, ap.longitude], targetZoom);
        const shiftedPoint = L.point(targetPoint.x + drawerWidth / 2, targetPoint.y);
        targetCenter = map.unproject(shiftedPoint, targetZoom);
      }

      // If already at target zoom, panTo is 10x smoother, avoids tile tearing and grey screen
      if (map.getZoom() === targetZoom) {
        map.panTo(targetCenter, {
          animate: true,
          duration: 0.45,
          noMoveStart: true,
        });
      } else {
        map.flyTo(targetCenter, targetZoom, {
          duration: 0.6,
          easeLinearity: 0.25,
          noMoveStart: true,
        });
      }

      // Proactively invalidate size to guarantee all viewport edge tiles render without gray voids
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ pan: false });
        }
      }, 120);
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ pan: false });
        }
      }, 350);
    },
    [drawerMode, currentTile]
  );

  // Handle open point details on map click: open lateral drawer without auto-zoom or camera jump
  const handleOpenPointGroup = useCallback(
    (group: LocationPointGroup) => {
      // If a different point was clicked, clear lingering selected network & triangulation if not in this group
      if (selectedAp && !group.networks.some((n) => n.mac === selectedAp.mac)) {
        onSelectAp(null as any);
        if (triangulationLayerRef.current) {
          triangulationLayerRef.current.clearLayers();
        }
        if (wasTriModeOriginallyDisabledRef.current) {
          setIsTriangulationMode(false);
          wasTriModeOriginallyDisabledRef.current = false;
        }
      }
      setActiveGroup(group);
      setDrawerMode('POINT_DETAILS');
      setDrawerSearch('');

      // Always reset lateral AP list to top on point click
      if (drawerListRef.current) {
        drawerListRef.current.scrollTop = 0;
      }
      requestAnimationFrame(() => {
        if (drawerListRef.current) {
          drawerListRef.current.scrollTop = 0;
        }
      });
    },
    [selectedAp, onSelectAp]
  );

  // Helper to compute observation point color and opacity based on WiGLE 7-tier RSSI scale
  const getTriangulationSignalStyle = (rssi: number) => {
    const tier = getWigleSignalTier(rssi);
    const [r, g, b] = tier.rgb;
    const bg = tier.hex;
    const border = tier.borderHex;
    const glow = `rgba(${r}, ${g}, ${b}, 0.65)`;
    const opacity = 0.92;

    return { bg, border, opacity, glow, tier };
  };

  // Update Markers based on location grouping
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    if (locationGroups.length === 0) return;

    // In triangulation mode with a multi-point AP selected, hide other network markers
    const hasActiveMultiTriangulation =
      isTriangulationMode &&
      selectedAp &&
      calculateTriangulation(selectedAp).hasMultiplePoints;

    if (hasActiveMultiTriangulation) {
      return; // Points of other networks are hidden in favor of focused triangulation view
    }

    // Attach global callback for popup actions
    (window as any).__wigleMapFilterLocation = (key: string, lat: number, lng: number) => {
      onFilterByLocation({ key, lat, lng });
    };

    (window as any).__wigleMapSelectAp = (mac: string) => {
      const found = accessPoints.find((a) => a.mac === mac);
      if (found) {
        onSelectAp(found);
      }
    };

    (window as any).__wigleMapOpenGroup = (key: string) => {
      const foundGroup = locationGroups.find((g) => g.key === key);
      if (foundGroup) {
        handleOpenPointGroup(foundGroup);
      }
    };

    // Determine the single active highlighted group key so only one point is ever circled in cyan
    let highlightedGroupKey: string | null = null;
    if (hoveredApMac) {
      const match = locationGroups.find((g) => g.networks.some((n) => n.mac === hoveredApMac));
      if (match) highlightedGroupKey = match.key;
    } else if (drawerMode === 'POINT_DETAILS' && activeGroup) {
      highlightedGroupKey = activeGroup.key;
    } else if (selectedAp) {
      const match = locationGroups.find((g) => g.networks.some((n) => n.mac === selectedAp.mac));
      if (match) highlightedGroupKey = match.key;
    } else if (activeLocationFilter) {
      highlightedGroupKey = activeLocationFilter.key;
    }

    // Fast numeric spatial culling: filter rendered points to visible viewport padded area for high performance on large datasets
    const paddedBounds = viewportBounds ? viewportBounds.pad(0.15) : null;
    let visibleGroups: typeof locationGroups;
    if (paddedBounds) {
      const minLat = paddedBounds.getSouth();
      const maxLat = paddedBounds.getNorth();
      const minLng = paddedBounds.getWest();
      const maxLng = paddedBounds.getEast();
      visibleGroups = [];
      for (let i = 0; i < locationGroups.length; i++) {
        const g = locationGroups[i];
        if (g.latitude >= minLat && g.latitude <= maxLat && g.longitude >= minLng && g.longitude <= maxLng) {
          visibleGroups.push(g);
        }
      }
    } else {
      visibleGroups = locationGroups;
    }

    // Fast Level-Of-Detail (LOD) aggregation when dezoomed (zoom < 16) or when viewport contains > 1200 points
    // Keeps canvas rendered elements strictly between ~100 and ~500 markers, ensuring 60 FPS ultra-smooth dezoom with 300,000+ networks!
    let groupsToRender: Array<{
      key: string;
      latitude: number;
      longitude: number;
      networks: ProcessedAccessPoint[];
      count: number;
      isCluster?: boolean;
    }> = visibleGroups;

    const zoomToUse = map.getZoom();
    if (zoomToUse < 16 || visibleGroups.length > 1000) {
      const centerLat = visibleGroups.length > 0 ? visibleGroups[0].latitude : 45.0;
      const cosLat = Math.cos((centerLat * Math.PI) / 180);
      const targetPixelGrid =
        zoomToUse <= 5 ? 110 :
        zoomToUse <= 7 ? 90 :
        zoomToUse <= 9 ? 75 :
        zoomToUse <= 11 ? 60 :
        zoomToUse <= 13 ? 46 :
        zoomToUse <= 15 ? 36 : 28;
      const metersPerPixel = (156543 * Math.max(0.1, cosLat)) / Math.pow(2, zoomToUse);
      const cellMeters = Math.max(25, targetPixelGrid * metersPerPixel);

      const cellLat = cellMeters / 111320;
      const cellLng = cellMeters / (111320 * Math.max(0.1, cosLat));

      interface AggregatedCluster {
        key: string;
        latSum: number;
        lngSum: number;
        sampleNetworks: ProcessedAccessPoint[];
        count: number;
        isCluster: boolean;
      }

      // Fast numeric spatial Map: 64-bit safe integer key avoids allocating hundreds of thousands of strings
      const clusterMap = new Map<number, AggregatedCluster>();

      for (let i = 0; i < visibleGroups.length; i++) {
        const g = visibleGroups[i];
        const gx = Math.floor(g.latitude / cellLat);
        const gy = Math.floor(g.longitude / cellLng);
        const cellKey = (gx + 500000) * 1000000 + (gy + 500000);

        const existing = clusterMap.get(cellKey);
        if (existing) {
          existing.latSum += g.latitude * g.count;
          existing.lngSum += g.longitude * g.count;
          existing.count += g.count;
          existing.isCluster = true;
          if (existing.sampleNetworks.length < 25) {
            for (let j = 0; j < g.networks.length && existing.sampleNetworks.length < 25; j++) {
              existing.sampleNetworks.push(g.networks[j]);
            }
          }
        } else {
          clusterMap.set(cellKey, {
            key: g.key,
            latSum: g.latitude * g.count,
            lngSum: g.longitude * g.count,
            sampleNetworks: g.networks.length <= 25 ? [...g.networks] : g.networks.slice(0, 25),
            count: g.count,
            isCluster: false,
          });
        }
      }

      groupsToRender = Array.from(clusterMap.values()).map((c) => ({
        key: c.key,
        latitude: c.latSum / c.count,
        longitude: c.lngSum / c.count,
        networks: c.sampleNetworks,
        count: c.count,
        isCluster: c.isCluster,
      }));

      // Strictly bound total rendered canvas markers to at most 600 for instant 60 FPS painting
      if (groupsToRender.length > 600) {
        groupsToRender.sort((a, b) => b.count - a.count);
        groupsToRender = groupsToRender.slice(0, 600);
      }
    }

    groupsToRender.forEach((group) => {
      const isHighlighted = highlightedGroupKey !== null && group.key === highlightedGroupKey;

      // Sizing based on network count (sleek uniform size)
      const radius = getLocationRadius(group.count);
      const color = getLocationColor(group.count);

      // Clean, elegant stroke styling: eliminate ugly white halos across all zoom levels
      const strokeColor = isHighlighted
        ? '#06b6d4'
        : currentZoom <= 14
        ? 'rgba(15, 23, 42, 0.45)'
        : 'rgba(15, 23, 42, 0.55)';
      const strokeWidth = isHighlighted ? 3.5 : currentZoom <= 14 ? 0.6 : 0.9;

      // Render directly on hardware-accelerated 2D Canvas for fluid 60fps interaction and zero DOM overhead
      const circle = L.circleMarker([group.latitude, group.longitude], {
        renderer: canvasRendererRef.current || undefined,
        radius,
        fillColor: color,
        fillOpacity: 0.95,
        color: strokeColor,
        weight: strokeWidth,
        text: group.count,
        textColor: '#ffffff',
        isHighlighted,
        font:
          group.count >= 100
            ? '800 8.5px ui-monospace, SFMono-Regular, monospace'
            : '800 10px ui-monospace, SFMono-Regular, monospace',
      } as any);

      // If highlighted (e.g. hovered from drawer), add an outer ring encircling the detection point
      if (isHighlighted) {
        const outerRing = L.circleMarker([group.latitude, group.longitude], {
          renderer: canvasRendererRef.current || undefined,
          radius: radius + 6,
          fillColor: '#06b6d4',
          fillOpacity: 0.25,
          color: '#0891b2',
          weight: 2.5,
          interactive: false,
        } as any);
        outerRing.addTo(markersLayer);
      }

      // When clicking the marker, smart group all APs for this point, open the lateral drawer and update table
      circle.on('click', () => {
        if (group.isCluster && currentZoom < 15 && mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([group.latitude, group.longitude], Math.min(16, currentZoom + 3), {
            duration: 0.4,
          });
        }
        handleOpenPointGroup(group);
      });

      circle.on('mouseover', () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.getContainer().style.cursor = 'pointer';
        }
      });

      circle.on('mouseout', () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.getContainer().style.cursor = '';
        }
      });

      circle.addTo(markersLayer);
    });

    return () => {
      delete (window as any).__wigleMapFilterLocation;
      delete (window as any).__wigleMapSelectAp;
      delete (window as any).__wigleMapOpenGroup;
    };
  }, [locationGroups, selectedAp, activeLocationFilter, theme, accessPoints, activeGroup, drawerMode, handleOpenPointGroup, isTriangulationMode, language, hoveredApMac, viewportBounds]);

  // Auto-fit map bounds strictly when a new dataset is loaded (never on zoom/pan or group change)
  const lastDatasetKeyRef = useRef<string>('');
  useEffect(() => {
    if (!mapInstanceRef.current || accessPoints.length === 0 || selectedAp) return;
    const validPoints = accessPoints.filter((a) => a.latitude !== 0 && a.longitude !== 0);
    if (validPoints.length === 0) return;

    const currentDatasetKey = `${accessPoints.length}_${validPoints[0]?.mac || ''}_${validPoints[validPoints.length - 1]?.mac || ''}`;
    if (lastDatasetKeyRef.current !== currentDatasetKey) {
      lastDatasetKeyRef.current = currentDatasetKey;
      const bounds = L.latLngBounds(validPoints.map((g) => [g.latitude, g.longitude]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
      updateMapBounds();
    }
  }, [accessPoints, selectedAp, updateMapBounds]);

  // Reset MAC ref and clear triangulation when selectedAp is cleared or triangulation mode changed
  useEffect(() => {
    if (!selectedAp || !isTriangulationMode) {
      if (!selectedAp) {
        prevSelectedMacRef.current = null;
        setHighlightedMac(null);
      }
      if (triangulationLayerRef.current) {
        triangulationLayerRef.current.clearLayers();
      }
    }
  }, [selectedAp, isTriangulationMode]);

  const prevTriModeRef = useRef<boolean>(isTriangulationMode);

  // Zoom / Focus and Render Triangulation when selecting an AP from list or clicking Map
  useEffect(() => {
    if (!selectedAp || !mapInstanceRef.current) return;
    if (selectedAp.latitude === 0 && selectedAp.longitude === 0) return;

    const isDifferentAp = prevSelectedMacRef.current !== selectedAp.mac;
    const isTriModeToggled = prevTriModeRef.current !== isTriangulationMode;
    prevSelectedMacRef.current = selectedAp.mac;
    prevTriModeRef.current = isTriangulationMode;

    // Clear previous triangulation layers
    if (triangulationLayerRef.current) {
      triangulationLayerRef.current.clearLayers();
    }

    // Check if multiple valid GPS detections exist to render full triangulation
    const tri = calculateTriangulation(selectedAp);

    if (isTriangulationMode && tri.hasMultiplePoints && triangulationLayerRef.current) {
      // 1. Accuracy circle around estimated centroid (Subtle emerald) - non-interactive so points inside are always hoverable
      L.circle([tri.estimatedLat, tri.estimatedLng], {
        radius: tri.accuracyRadiusMeters,
        color: '#059669',
        weight: 1.5,
        dashArray: '4, 4',
        fillColor: '#10b981',
        fillOpacity: 0.10,
        interactive: false,
      } as any).addTo(triangulationLayerRef.current);

      // 2. Add connecting dashed lines and colored observation points
      tri.points.forEach((p) => {
        const sigStyle = getTriangulationSignalStyle(p.rssi);

        // Connecting dashed line matching observation point's signal color
        L.polyline([[p.lat, p.lng], [tri.estimatedLat, tri.estimatedLng]], {
          color: sigStyle.bg,
          weight: 2,
          dashArray: '5, 5',
          opacity: 0.8,
          interactive: false,
        } as any).addTo(triangulationLayerRef.current!);

        // Clean observation sensor node (without static label; tooltip on hover)
        const obsIcon = L.divIcon({
          className: 'wigle-tri-obs-point',
          html: `
            <div style="
              width: 18px;
              height: 18px;
              background: ${sigStyle.bg};
              border: 2px solid #ffffff;
              box-shadow: 0 0 6px ${sigStyle.glow}, 0 2px 4px rgba(0,0,0,0.5);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
            ">
            </div>
          `,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        const obsMarker = L.marker([p.lat, p.lng], { icon: obsIcon, zIndexOffset: 2500 });
        obsMarker.bindTooltip(
          language === 'fr' ? `Niveau\u00A0: ${p.rssi}\u00A0dBm` : `Strength: ${p.rssi} dBm`,
          { direction: 'top', offset: [0, -10], opacity: 0.98 }
        );
        obsMarker.addTo(triangulationLayerRef.current!);
      });

      // 3. Add Estimated AP position marker (Crisp central beacon with clearly visible WiFi icon)
      const centerIcon = L.divIcon({
        className: 'wigle-tri-center-icon',
        html: `
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; pointer-events: auto;">
            <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(16, 185, 129, 0.25); animation: ping 2.5s cubic-bezier(0, 0.2, 0.8, 1) infinite; pointer-events: none;"></div>
            <div style="
              position: relative;
              z-index: 10;
              width: 30px;
              height: 30px;
              border-radius: 50%;
              background: #047857;
              border: 2.5px solid #ffffff;
              box-shadow: 0 0 10px rgba(16, 185, 129, 0.7), 0 3px 6px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              cursor: pointer;
            ">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h.01"/>
                <path d="M2 8.82a15 15 0 0 1 20 0"/>
                <path d="M5 12.859a10 10 0 0 1 14 0"/>
                <path d="M8.5 16.429a5 5 0 0 1 7 0"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const centerMarker = L.marker([tri.estimatedLat, tri.estimatedLng], {
        icon: centerIcon,
        zIndexOffset: 1200,
      }).addTo(triangulationLayerRef.current);

      const popupHtml = `
        <div style="font-family:sans-serif;font-size:12px;color:#0f172a;min-width:230px;padding:4px;">
          <div style="font-weight:bold;color:#047857;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/></svg>
            <span>${language === 'fr' ? 'Position estimée par triangulation' : 'Estimated Position from Triangulation'}</span>
          </div>
          <div style="font-weight:bold;font-size:13px;margin-bottom:2px;">${selectedAp.ssid || (language === 'fr' ? '<SSID Masqué>' : '<Hidden SSID>')}</div>
          <div style="font-size:10px;color:#64748b;font-family:monospace;margin-bottom:6px;">${language === 'fr' ? 'BSSID\u00A0: ' : 'BSSID: '}${selectedAp.mac}</div>
          <div style="background:#f1f5f9;padding:6px;border-radius:6px;font-size:11px;">
            <div><b>${language === 'fr' ? 'GPS\u00A0:' : 'GPS:'}</b> ${tri.estimatedLat.toFixed(5)}, ${tri.estimatedLng.toFixed(5)}</div>
            <div><b>${language === 'fr' ? 'Précision\u00A0:' : 'Accuracy:'}</b> ±\u00A0${tri.accuracyRadiusMeters.toFixed(1)}${language === 'fr' ? '\u00A0m' : ' m'}</div>
            <div><b>${language === 'fr' ? 'Multilatération\u00A0:' : 'Multilateration:'}</b> ${tri.pointCount} ${language === 'fr' ? 'détections pondérées' : 'weighted detections'} (RSSI ${tri.strongestRssi}${language === 'fr' ? '\u00A0dBm' : ' dBm'} à ${tri.weakestRssi}${language === 'fr' ? '\u00A0dBm' : ' dBm'})</div>
          </div>
        </div>
      `;
      centerMarker.bindPopup(popupHtml);

      // Fit bounds only when selecting a different AP or toggling triangulation mode when AP belongs to active group
      const isApInActiveGroup = !activeGroup || activeGroup.networks.some((n) => n.mac === selectedAp.mac);
      if (isDifferentAp || (isTriModeToggled && isApInActiveGroup)) {
        const allCoords = [[tri.estimatedLat, tri.estimatedLng], ...tri.points.map((p) => [p.lat, p.lng])];
        const triBounds = L.latLngBounds(allCoords as [number, number][]);
        mapInstanceRef.current.fitBounds(triBounds, { padding: [70, 70], maxZoom: 18 });
      }
    }

    // Only pan or open drawer if the selected AP changed
    if (!isDifferentAp) return;

    // Find its location group on the map by MAC address
    const matchingGroup = locationGroups.find((g) =>
      g.networks.some((n) => n.mac === selectedAp.mac)
    );

    if (matchingGroup) {
      setActiveGroup(matchingGroup);
      setDrawerMode('POINT_DETAILS');
      setDrawerSearch('');
      setHighlightedMac(selectedAp.mac);
      if (!isTriangulationMode || !tri.hasMultiplePoints) {
        centerOnAp(selectedAp, 18, true);
      }

      // Scroll the drawer list to the selected card without affecting the window viewport
      setTimeout(() => {
        const cardEl = document.getElementById(`drawer-ap-${selectedAp.mac}`);
        if (cardEl && drawerListRef.current) {
          const container = drawerListRef.current;
          const cardOffset = cardEl.offsetTop - container.offsetTop;
          container.scrollTo({ top: Math.max(0, cardOffset - 8), behavior: 'smooth' });
        }
      }, 150);

      // Flash/blink highlight for exactly 2 seconds
      const timer = setTimeout(() => {
        setHighlightedMac((curr) => (curr === selectedAp.mac ? null : curr));
      }, 2000);

      return () => clearTimeout(timer);
    } else if (!isTriangulationMode || !tri.hasMultiplePoints) {
      centerOnAp(selectedAp, 18);
    }
  }, [selectedAp, isTriangulationMode, centerOnAp, language, activeGroup]);

  // Show entire route (Fit bounds to all points)
  const handleShowEntireRoute = () => {
    if (!mapInstanceRef.current || locationGroups.length === 0) return;
    const bounds = L.latLngBounds(locationGroups.map((g) => [g.latitude, g.longitude]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
    updateMapBounds();
  };

  // Compute networks visible inside the current map viewport bounds
  const visibleViewportAps = useMemo(() => {
    if (!viewportBounds) return accessPoints;
    return accessPoints.filter((ap) => {
      if (ap.latitude === 0 && ap.longitude === 0) return false;
      return viewportBounds.contains([ap.latitude, ap.longitude]);
    });
  }, [accessPoints, viewportBounds]);

  // Sort networks based on user's persistent drawer selection
  const sortNetworks = useCallback(
    (list: ProcessedAccessPoint[]) => {
      return [...list].sort((a, b) => {
        switch (drawerSort) {
          case 'SSID':
            return (a.ssid || 'zzz').localeCompare(b.ssid || 'zzz', undefined, { sensitivity: 'base' });
          case 'MAC':
            return a.mac.localeCompare(b.mac);
          case 'VENDOR':
            return (a.vendor || '').localeCompare(b.vendor || '');
          case 'SECURITY':
            return (a.security?.label || '').localeCompare(b.security?.label || '');
          case 'SIGNAL':
            return b.bestRssi - a.bestRssi; // Strongest first (-30 before -80)
          case 'CHANNEL': {
            const chA = typeof a.channel === 'number' ? a.channel : parseInt(String(a.channel), 10) || 0;
            const chB = typeof b.channel === 'number' ? b.channel : parseInt(String(b.channel), 10) || 0;
            return chA - chB;
          }
          case 'FIRST_SEEN':
            return b.firstSeen.localeCompare(a.firstSeen); // Most recent first
          default:
            return 0;
        }
      });
    },
    [drawerSort]
  );

  // Filtered networks inside active point group
  const filteredGroupNetworks = useMemo(() => {
    if (!activeGroup) return [];
    const filtered = activeGroup.networks.filter((ap) => {
      if (drawerSearch) {
        const q = drawerSearch.toLowerCase().trim();
        const matchSsid = ap.ssid.toLowerCase().includes(q);
        const matchMac = ap.mac.toLowerCase().includes(q);
        const matchVendor = ap.vendor.toLowerCase().includes(q);
        if (!matchSsid && !matchMac && !matchVendor) return false;
      }
      if (drawerSecurityFilter !== 'ALL') {
        if (drawerSecurityFilter === 'ENTERPRISE') {
          const secType = ap.security.type || '';
          const isEnterprise =
            secType === 'ENTERPRISE' ||
            secType === 'WPA3_ENTERPRISE' ||
            secType === 'WPA1_ENTERPRISE' ||
            secType.includes('ENTERPRISE') ||
            (ap.authMode || '').toUpperCase().includes('ENTERPRISE') ||
            (ap.authMode || '').toUpperCase().includes('EAP');
          if (!isEnterprise) return false;
        } else if (ap.security.type !== drawerSecurityFilter) {
          return false;
        }
      }
      return true;
    });
    return sortNetworks(filtered);
  }, [activeGroup, drawerSearch, drawerSecurityFilter, sortNetworks]);

  // Filtered networks inside active viewport drawer
  const filteredViewportNetworks = useMemo(() => {
    const filtered = visibleViewportAps.filter((ap) => {
      if (drawerSearch) {
        const q = drawerSearch.toLowerCase().trim();
        const matchSsid = ap.ssid.toLowerCase().includes(q);
        const matchMac = ap.mac.toLowerCase().includes(q);
        const matchVendor = ap.vendor.toLowerCase().includes(q);
        if (!matchSsid && !matchMac && !matchVendor) return false;
      }
      if (drawerSecurityFilter !== 'ALL') {
        if (drawerSecurityFilter === 'ENTERPRISE') {
          const secType = ap.security.type || '';
          const isEnterprise =
            secType === 'ENTERPRISE' ||
            secType === 'WPA3_ENTERPRISE' ||
            secType === 'WPA1_ENTERPRISE' ||
            secType.includes('ENTERPRISE') ||
            (ap.authMode || '').toUpperCase().includes('ENTERPRISE') ||
            (ap.authMode || '').toUpperCase().includes('EAP');
          if (!isEnterprise) return false;
        } else if (ap.security.type !== drawerSecurityFilter) {
          return false;
        }
      }
      return true;
    });
    return sortNetworks(filtered);
  }, [visibleViewportAps, drawerSearch, drawerSecurityFilter, sortNetworks]);

  // Helper badge for RSSI with WiGLE 7-tier colors and high readability font
  const renderRssiBadge = (rssi: number) => {
    const tier = getWigleSignalTier(rssi);
    const levelLabel = language === 'fr' ? tier.labelFr : tier.labelEn;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border tracking-tight font-sans shadow-xs shrink-0 ${tier.badgeClasses}`}
      >
        <span>{rssi}{language === 'fr' ? '\u00A0dBm' : ' dBm'}</span>
        <span className="font-semibold opacity-90">({levelLabel})</span>
      </span>
    );
  };

  // Helper badge for security with matching padlocks, colors, and RAW tooltip
  const renderSecurityBadge = (ap: ProcessedAccessPoint) => {
    const sec = ap.security;
    const rawTitle = (ap.authMode && ap.authMode.trim() !== '') ? ap.authMode : (sec.label ? `[${sec.label}]` : '[]');
    if (sec.type === 'OPEN' || !sec.isSecure) {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-400 dark:border-rose-600 cursor-default"
        >
          <Unlock className="w-3 h-3 stroke-[2] text-rose-600 dark:text-rose-400 shrink-0" />
          <span>OPEN</span>
        </span>
      );
    }
    if (sec.type === 'WPA3') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700 cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-purple-600 dark:text-purple-400 shrink-0" />
          <span>WPA3</span>
        </span>
      );
    }
    if (sec.type === 'WPA3_ENTERPRISE') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>WPA3 Enterprise</span>
        </span>
      );
    }
    if (sec.type === 'WPA2_WPA3') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-700 cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-fuchsia-600 dark:text-fuchsia-400 shrink-0" />
          <span>WPA2/WPA3</span>
        </span>
      );
    }
    if (sec.type === 'ENTERPRISE') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span>WPA2 Enterprise</span>
        </span>
      );
    }
    if (sec.type === 'WPA1_ENTERPRISE') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700 cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-sky-600 dark:text-sky-400 shrink-0" />
          <span>WPA1 Enterprise</span>
        </span>
      );
    }
    if (sec.type === 'WPA_WPA2') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700 cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-sky-600 dark:text-sky-400 shrink-0" />
          <span>WPA1/WPA2</span>
        </span>
      );
    }
    if (sec.type === 'WEP') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-400 dark:border-rose-600 cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-rose-600 dark:text-rose-400 shrink-0" />
          <span>WEP</span>
        </span>
      );
    }
    if (sec.type === 'WPA') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700 cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-yellow-600 dark:text-yellow-400 shrink-0" />
          <span>WPA1 (PSK)</span>
        </span>
      );
    }
    return (
      <span
        title={rawTitle}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700 cursor-default"
      >
        <Lock className="w-3 h-3 stroke-[2.5] text-blue-600 dark:text-blue-400 shrink-0" />
        <span>WPA2 (PSK)</span>
      </span>
    );
  };

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-xl bg-slate-100 dark:bg-slate-900 transition-all h-[540px] lg:h-[620px]"
    >
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Active Location Filter Banner (Top Center) */}
      {activeLocationFilter && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-cyan-600 text-white px-4 py-2 rounded-xl shadow-xl flex items-center gap-3 backdrop-blur-md border border-cyan-400/50 text-xs font-semibold animate-fadeIn">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            <span>
              {language === 'fr' ? "Filtré sur l'emplacement\u00A0:" : 'Filtered to Location:'} <strong>{activeLocationFilter.key}</strong>
            </span>
          </div>
          <button
            onClick={() => onFilterByLocation(null)}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded-lg text-[11px] transition-colors cursor-pointer"
            title={language === 'fr' ? 'Réinitialiser le filtre de localisation' : 'Reset location filter'}
          >
            <RotateCcw className="w-3 h-3" />
            <span>{language === 'fr' ? 'Afficher tous les réseaux' : 'Show All Networks'}</span>
          </button>
        </div>
      )}

      {/* Floating Control Bar (Top Left) */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 items-center">
        {/* Multi-Layer Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white shadow-lg font-medium cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>{TILE_LAYERS[currentTile].name.split(' ')[0]}</span>
          </button>

          {isLayerMenuOpen && (
            <div
              className="absolute top-full left-0 mt-1.5 flex flex-col bg-white dark:bg-slate-900/95 backdrop-blur-lg border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 shadow-2xl min-w-[210px] z-30 space-y-1"
              onMouseLeave={() => setIsLayerMenuOpen(false)}
            >
              {Object.entries(TILE_LAYERS).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => {
                    setCurrentTile(key as keyof typeof TILE_LAYERS);
                    setIsLayerMenuOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    currentTile === key
                      ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {cfg.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 1. Show Entire Route Button */}
        <button
          onClick={handleShowEntireRoute}
          disabled={locationGroups.length === 0}
          title={language === 'fr' ? 'Centrer et afficher tous les points sur la carte' : 'Center and show all points on the map'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-cyan-500 shadow-lg font-semibold transition-all disabled:opacity-50 cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>{language === 'fr' ? "Vue d'ensemble" : 'Overview'}</span>
        </button>

        {/* 2. Triangulation Mode Toggle Button (Positioned between Show entire route and Filter by map view) */}
        <button
          onClick={handleToggleTriangulationMode}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-lg backdrop-blur-md transition-all border cursor-pointer ${
            isTriangulationMode
              ? 'bg-cyan-600 border-cyan-500 text-white'
              : 'bg-white/95 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-cyan-500'
          }`}
          title={language === 'fr' ? 'Activer ou désactiver le mode triangulation' : 'Toggle triangulation mode'}
        >
          <Wifi className="w-3.5 h-3.5 text-cyan-400" />
          <span>{language === 'fr' ? 'Mode triangulation' : 'Triangulation mode'}</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              isTriangulationMode
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {isTriangulationMode ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* 3. Filter / Search by Map View Button (Opens Lateral Drawer) */}
        <button
          onClick={() => {
            updateMapBounds();
            setDrawerMode(drawerMode === 'VIEWPORT_FILTER' ? 'NONE' : 'VIEWPORT_FILTER');
            setDrawerSearch('');
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-lg backdrop-blur-md transition-all border cursor-pointer ${
            drawerMode === 'VIEWPORT_FILTER'
              ? 'bg-cyan-600 border-cyan-500 text-white'
              : 'bg-white/95 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-cyan-500'
          }`}
          title={language === 'fr' ? 'Filtrer et lister les points d\'accès visibles dans la vue actuelle' : 'Filter and list all access points visible in current map view'}
        >
          <Search className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
          <span>{language === 'fr' ? 'Afficher les détails des réseaux de cette zone' : 'Show details about networks of this area'}</span>
          {visibleViewportAps.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${drawerMode === 'VIEWPORT_FILTER' ? 'bg-white/20 text-white' : 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300'}`}>
              {visibleViewportAps.length}
            </span>
          )}
        </button>
      </div>

      {/* Top Right Controls: Exit Triangulation Button */}
      {isTriangulationMode && selectedAp && calculateTriangulation(selectedAp).hasMultiplePoints && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            onClick={() => {
              onSelectAp(null as any);
              if (triangulationLayerRef.current) {
                triangulationLayerRef.current.clearLayers();
              }
              if (wasTriModeOriginallyDisabledRef.current) {
                setIsTriangulationMode(false);
                wasTriModeOriginallyDisabledRef.current = false;
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-xl text-xs font-bold transition-all border border-cyan-400/60 backdrop-blur-md cursor-pointer animate-fadeIn"
            title={language === 'fr' ? 'Sortir du mode triangulation et réafficher tous les points' : 'Exit triangulation and show all location points again'}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{language === 'fr' ? 'Réafficher tous les points' : 'Show all points again'}</span>
          </button>
        </div>
      )}

      {/* LATERAL SLIDE-OVER MENU / DRAWER (Point Groups & Map View Filter) */}
      {drawerMode !== 'NONE' && (
        <div className="absolute top-0 right-0 bottom-0 z-30 w-[420px] sm:w-[460px] md:w-[500px] max-w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-slideLeft transition-all">
          {/* Lateral Drawer Header */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {drawerMode === 'POINT_DETAILS' ? (
                  <>
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                      style={{
                        backgroundColor: activeGroup ? getLocationColor(activeGroup.count) : '#0284c7',
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                          {language === 'fr'
                            ? `Groupe de réseaux\u00A0: ${activeGroup?.count || 0} ${(activeGroup?.count || 0) > 1 ? "points d'accès" : "point d'accès"}`
                            : `Network Group: ${activeGroup?.count || 0} ${(activeGroup?.count || 0) > 1 ? 'networks' : 'network'}`}
                        </h3>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans font-medium">
                        {activeGroup?.latitude.toFixed(5)}, {activeGroup?.longitude.toFixed(5)}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <div>
                      <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                        {language === 'fr' ? 'Détails des réseaux visibles sur la carte' : 'Details of network visible on the map'}
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans font-medium">
                        {visibleViewportAps.length} {language === 'fr' ? 'réseaux dans la zone définie' : 'networks in the defined area'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleCloseDrawer}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={language === 'fr' ? 'Fermer le menu latéral' : 'Close lateral menu'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions Bar inside Drawer Header */}
            <div className="flex items-center justify-between gap-1.5 mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              {drawerMode === 'POINT_DETAILS' && activeGroup && (
                <button
                  onClick={() => {
                    onFilterByLocation({
                      key: activeGroup.key,
                      lat: activeGroup.latitude,
                      lng: activeGroup.longitude,
                    });
                  }}
                  className="flex-1 py-1 px-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[10px] flex items-center justify-center gap-1 shadow transition-colors cursor-pointer"
                >
                  <Filter className="w-3 h-3" />
                  <span>{language === 'fr' ? 'Ajouter un filtre sur le tableau pour ce point' : 'Filter Table to this Point'}</span>
                </button>
              )}
            </div>

            {/* Search Input inside Drawer */}
            <div className="relative mt-2.5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                placeholder={language === 'fr' ? 'Rechercher par SSID, BSSID/MAC, fabricant...' : 'Search by SSID, BSSID/MAC, manufacturer...'}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
              />
              {drawerSearch && (
                <button
                  onClick={() => setDrawerSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sort Controls inside Drawer */}
            <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                <ArrowUpDown className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                <span>{language === 'fr' ? 'Trier par\u00A0:' : 'Sort by:'}</span>
              </label>
              <select
                value={drawerSort}
                onChange={(e) => handleDrawerSortChange(e.target.value as DrawerSortOption)}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
              >
                <option value="SSID">SSID</option>
                <option value="MAC">BSSID / MAC</option>
                <option value="VENDOR">{language === 'fr' ? 'Fabricant' : 'Manufacturer'}</option>
                <option value="SECURITY">{language === 'fr' ? 'Sécurité / Chiffrement' : 'Security'}</option>
                <option value="SIGNAL">{language === 'fr' ? 'Signal' : 'Signal'}</option>
                {!isWigleDevice && <option value="CHANNEL">{language === 'fr' ? 'Canal' : 'Channel'}</option>}
                <option value="FIRST_SEEN">{language === 'fr' ? '1ère Détection' : 'First Seen'}</option>
              </select>
            </div>

            {/* Filter Pills inside Drawer */}
            <div className="overflow-x-auto custom-scrollbar pt-2 pb-2.5 mt-1">
              <div className="flex items-center gap-1 min-w-max text-[10px] px-0.5">
                {[
                  { id: 'ALL', label: language === 'fr' ? 'Tous' : 'All' },
                  { id: 'OPEN', label: language === 'fr' ? 'Ouvert' : 'Open' },
                  { id: 'WEP', label: 'WEP' },
                  { id: 'WPA', label: 'WPA1' },
                  { id: 'WPA_WPA2', label: 'WPA1/2' },
                  { id: 'WPA2', label: 'WPA2' },
                  { id: 'WPA2_WPA3', label: 'WPA2/3' },
                  { id: 'WPA3', label: 'WPA3' },
                  { id: 'ENTERPRISE', label: language === 'fr' ? 'Entreprise' : 'Enterprise' },
                ]
                  .filter((item) => {
                    if (isWigleDevice) {
                      return !['WPA_WPA2', 'WPA2_WPA3', 'ENTERPRISE'].includes(item.id);
                    }
                    return true;
                  })
                  .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setDrawerSecurityFilter(item.id)}
                    className={`px-2 py-1 rounded-md font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      drawerSecurityFilter === item.id
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grouped APs Scrollable List */}
          <div ref={drawerListRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {(drawerMode === 'POINT_DETAILS'
              ? filteredGroupNetworks
              : filteredViewportNetworks
            ).length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400">
                {language === 'fr'
                  ? 'Aucun point d\'accès ne correspond à votre recherche dans cette sélection.'
                  : 'No access points match your search in this selection.'}
              </div>
            ) : (
              (drawerMode === 'POINT_DETAILS'
                ? filteredGroupNetworks
                : filteredViewportNetworks
              ).map((ap) => {
                const isSelected = selectedAp?.mac === ap.mac;
                const hasWps = ap.hasWps || (ap.authMode || '').toUpperCase().includes('WPS');
                const history = analyzeNetworkHistory(ap);
                const triRes = calculateTriangulation(ap);

                return (
                  <div
                    id={`drawer-ap-${ap.mac}`}
                    key={ap.mac}
                    onMouseEnter={() => setHoveredApMac(ap.mac)}
                    onMouseLeave={() => setHoveredApMac(null)}
                    onClick={() => {
                      if (selectedAp?.mac === ap.mac) {
                        onSelectAp(null as any);
                        if (triangulationLayerRef.current) {
                          triangulationLayerRef.current.clearLayers();
                        }
                        if (wasTriModeOriginallyDisabledRef.current) {
                          setIsTriangulationMode(false);
                          wasTriModeOriginallyDisabledRef.current = false;
                        }
                      } else {
                        // If triangulation mode was originally disabled, temporarily activate it
                        if (!isTriangulationMode) {
                          wasTriModeOriginallyDisabledRef.current = true;
                          setIsTriangulationMode(true);
                        }
                        onSelectAp(ap);
                        centerOnAp(ap, 18);
                      }
                    }}
                    className={`cursor-pointer p-2.5 rounded-xl border transition-all ${
                      highlightedMac === ap.mac
                        ? 'ring-4 ring-cyan-400 dark:ring-cyan-500 animate-brief-pulse bg-cyan-100 dark:bg-cyan-900/90 border-cyan-500 shadow-lg scale-[1.01]'
                        : isSelected
                        ? 'bg-cyan-50/90 dark:bg-cyan-950/80 border-cyan-400 dark:border-cyan-500 shadow-sm ring-1 ring-cyan-400/50'
                        : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-cyan-400/60 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* SSID & Signal */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Radio className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {ap.ssid || <i className="text-slate-400 font-normal">&lt;{language === 'fr' ? 'SSID Masqué' : 'Hidden SSID'}&gt;</i>}
                        </span>
                        {history.hasSsidChanged && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryModalAp(ap);
                              setHistoryModalType('SSID');
                            }}
                            title={
                              language === 'fr'
                                ? `Changement de SSID détecté (${history.ssidTimeline.length} noms constatés) ! Cliquez pour voir l'historique`
                                : `SSID change detected (${history.ssidTimeline.length} names recorded)! Click to view history`
                            }
                            className="p-1 rounded bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 transition-all cursor-pointer shrink-0 shadow-2xs"
                          >
                            <History className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {renderRssiBadge(ap.bestRssi)}
                    </div>

                    {/* MAC, Vendor & Channel / GHz / GPS (Vertically centered between SSID and Encryption) */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 my-1.5 gap-2">
                      {/* Left: MAC & Vendor stacked tightly and centered */}
                      <div className="flex flex-col justify-center min-w-0 flex-1">
                        <span className="font-sans font-semibold text-[10px] tracking-tight text-slate-500 dark:text-slate-400 leading-tight">{ap.mac}</span>
                        <span
                          className="truncate font-medium text-[11px] text-slate-700 dark:text-slate-200 leading-tight mt-0.5"
                          title={ap.vendor || ''}
                        >
                          {ap.vendor || <i className="text-slate-400 font-normal">&lt;{language === 'fr' ? 'Inconnu' : 'Unknown'}&gt;</i>}
                        </span>
                      </div>

                      {/* Right: Channel, Band, GPS */}
                      <div className="flex flex-col items-end shrink-0 justify-center">
                        {!isWigleDevice && (
                          ap.isWigleOnly || !ap.channel || ap.channel === '0' || ap.channel === '' ? (
                            <span className="text-slate-400 dark:text-slate-500 font-sans font-medium text-xs">—</span>
                          ) : (
                            <>
                              <span className="font-sans font-bold text-xs text-slate-700 dark:text-slate-300 leading-tight">
                                {language === 'fr' ? 'Canal' : 'Ch.'} {ap.channel}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">
                                {ap.band}
                              </span>
                            </>
                          )
                        )}
                        {(triRes.estimatedLat !== 0 || triRes.estimatedLng !== 0) && (
                          <span
                            className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 leading-tight mt-0.5 flex items-center gap-0.5"
                            title={language === 'fr' ? 'Coordonnées GPS (Triangulation)' : 'GPS Coordinates (Triangulation)'}
                          >
                            <MapPin className="w-2.5 h-2.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                            <span>{triRes.estimatedLat.toFixed(5)}, {triRes.estimatedLng.toFixed(5)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Security & WPS Badges */}
                    <div className="flex items-center justify-between gap-1 mt-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {renderSecurityBadge(ap)}
                        {history.hasSecurityChanged && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryModalAp(ap);
                              setHistoryModalType('SECURITY');
                            }}
                            title={
                              language === 'fr'
                                ? `Changement de chiffrement détecté (${history.securityTimeline.length} modes) ! Cliquez pour voir l'historique`
                                : `Security change detected (${history.securityTimeline.length} modes)! Click to view history`
                            }
                            className="p-1 rounded bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/80 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700/80 transition-all cursor-pointer shrink-0 shadow-2xs"
                          >
                            <History className="w-3 h-3" />
                          </button>
                        )}
                        {(() => {
                          const rawMode = (ap.authMode || '').toUpperCase();
                          const isOweTrans =
                            rawMode.includes('OWE-TRANS') ||
                            rawMode.includes('OWE_TRANS') ||
                            rawMode.includes('OWE-TRANSITION') ||
                            rawMode.includes('OWE_TRANSITION') ||
                            (rawMode.includes('OWE') && (rawMode.includes('TRANSITION') || rawMode.includes('TRANS'))) ||
                            ap.security.label.includes('OWE Transition');
                          const isOwe = rawMode.includes('OWE') || ap.security.label.includes('OWE');

                          if (isOweTrans) {
                            return (
                              <span
                                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100/80 dark:bg-purple-950/90 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700 shadow-2xs whitespace-nowrap inline-block"
                                title={ap.authMode || '[]'}
                              >
                                OWE Transition (WPA3 Enhanced Open)
                              </span>
                            );
                          }

                          if (isOwe) {
                            return (
                              <span
                                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100/80 dark:bg-purple-950/90 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700 shadow-2xs whitespace-nowrap inline-block"
                                title={ap.authMode || '[]'}
                              >
                                OWE (WPA3 Enhanced Open)
                              </span>
                            );
                          }

                          if (ap.security.type === 'OPEN') {
                            return null; // Never display [ESS] as a cipher
                          }

                          if (!isWigleDevice && ap.security.cipherLabel) {
                            if (ap.isWigleOnly && !ap.hasCompleteDetails) {
                              return null;
                            }
                            return (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap inline-block"
                                title={ap.authMode || '[]'}
                              >
                                {ap.security.cipherLabel}
                              </span>
                            );
                          }

                          return null;
                        })()}
                        {hasWps && (!ap.isWigleOnly || ap.hasCompleteDetails) && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                            WPS
                          </span>
                        )}
                      </div>

                      {/* Detail Inspector Trigger */}
                      {onInspectAp && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectAp(ap);
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white transition-colors text-[10px] font-semibold flex items-center gap-1 shadow-2xs cursor-pointer whitespace-nowrap shrink-0 self-end ml-auto"
                        >
                          <Info className="w-3 h-3 shrink-0" />
                          <span className="whitespace-nowrap">{language === 'fr' ? 'Détails' : 'Details'}</span>
                        </button>
                      )}
                    </div>

                    {/* First seen timestamp (smart & non-intrusive) */}
                    {ap.firstSeen && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 font-sans">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{language === 'fr' ? '1ère détection\u00A0:' : 'First seen:'}</span>
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {formatToEuropeanDate(ap.firstSeen)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer Status */}
          <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-end">
            <button
              onClick={handleCloseDrawer}
              className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
            >
              {language === 'fr' ? 'Fermer le menu latéral' : 'Close lateral menu'}
            </button>
          </div>
        </div>
      )}

      {/* Legend Overlay (Bottom Right) showing networks per point (Slightly lowered above OSM attribution) */}
      <div className="absolute bottom-6 sm:bottom-7 right-4 z-10 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 shadow-xl max-w-xs text-xs">
        <div className="flex items-center justify-between gap-4 font-semibold text-slate-800 dark:text-slate-200 pb-1.5 mb-1.5 border-b border-slate-200 dark:border-slate-800">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            {language === 'fr' ? 'Réseaux par emplacement' : 'Networks per Location'}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans font-medium">
            {locationGroups.length} {language === 'fr' ? 'emplacements' : 'locations'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] shadow-sm shrink-0"></span>
            <span className="text-slate-700 dark:text-slate-300">{language === 'fr' ? '1 Réseau' : '1 Network'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-sm shrink-0"></span>
            <span className="text-slate-700 dark:text-slate-300">{language === 'fr' ? '2 - 4 Réseaux' : '2 - 4 Networks'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#eab308] shadow-sm shrink-0"></span>
            <span className="text-slate-700 dark:text-slate-300">{language === 'fr' ? '5 - 9 Réseaux' : '5 - 9 Networks'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] shadow-sm shrink-0"></span>
            <span className="text-slate-700 dark:text-slate-300">{language === 'fr' ? '10 - 24 Réseaux' : '10 - 24 Networks'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shadow-sm shrink-0"></span>
            <span className="text-slate-700 dark:text-slate-300">{language === 'fr' ? '25 - 49 Réseaux' : '25 - 49 Networks'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#9333ea] shadow-sm shrink-0"></span>
            <span className="text-slate-700 dark:text-slate-300">{language === 'fr' ? '50 - 99 Réseaux' : '50 - 99 Networks'}</span>
          </div>
          <div className="flex items-center gap-1.5 col-span-2 pt-0.5 border-t border-slate-100 dark:border-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1e1b4b] shadow-sm shrink-0 border border-slate-300 dark:border-slate-600"></span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">{language === 'fr' ? '+ de 100 Réseaux' : '100+ Networks'}</span>
          </div>
        </div>
      </div>

      {locationGroups.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/75 dark:bg-slate-950/75 backdrop-blur-xs z-20 pointer-events-auto">
          <div className="text-center p-6 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl max-w-md mx-4">
            {totalGpsPointsCount === 0 ? (
              <>
                <MapPin className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                  {language === 'fr' ? 'Aucune coordonnée GPS' : 'No GPS Coordinates'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {language === 'fr'
                    ? 'Les fichiers de scan importés ne contiennent pas de coordonnées GPS valides.'
                    : 'The imported scan files do not contain valid GPS latitude/longitude coordinates.'}
                </p>
              </>
            ) : (
              <>
                {isOnlyModifiedFilterActive ? (
                  <History className="w-10 h-10 text-cyan-600 dark:text-cyan-400 mx-auto mb-3" />
                ) : (
                  <Filter className="w-10 h-10 text-cyan-600 dark:text-cyan-400 mx-auto mb-3" />
                )}
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  {isOnlyModifiedFilterActive
                    ? (language === 'fr' ? 'Aucun réseau modifié au fil du temps' : 'No networks modified over time')
                    : (language === 'fr' ? 'Aucun réseau correspondant' : 'No matching networks')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
                  {isOnlyModifiedFilterActive
                    ? (language === 'fr'
                        ? 'Aucun réseau n\'a présenté de modification au fil du temps (Nouveau SSID ou changement de chiffrement).'
                        : 'No network showed any changes over time (New SSID or encryption change).')
                    : (language === 'fr'
                        ? 'Aucun réseau ne correspond à vos filtres actuels.'
                        : 'No networks match your current filter criteria.')}
                </p>
                {onResetFilters && (
                  <button
                    onClick={onResetFilters}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{language === 'fr' ? 'Réinitialiser les filtres' : 'Reset Filters'}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Network Evolution & Change History Modal */}
      {historyModalAp && (
        <NetworkHistoryModal
          isOpen={!!historyModalAp}
          onClose={() => setHistoryModalAp(null)}
          ap={historyModalAp}
          initialType={historyModalType}
          isWigleDevice={isWigleDevice}
        />
      )}
    </div>
  );
};
