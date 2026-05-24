import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeoPoint, KmMarker } from '../types'

// Fix Leaflet default marker icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: '', iconRetinaUrl: '', shadowUrl: '' })

interface Props {
  route: GeoPoint[]
  kmMarkers?: KmMarker[]
  showFullRoute?: boolean   // fit all points into view (summary mode)
  style?: React.CSSProperties
  className?: string
}

export default function RunMap({ route, kmMarkers = [], showFullRoute = false, style, className = '' }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<L.Map | null>(null)
  const polyRef        = useRef<L.Polyline | null>(null)
  const posMarkerRef   = useRef<L.Marker | null>(null)
  const startMarkerRef = useRef<L.Marker | null>(null)
  const kmLayerRef     = useRef<L.LayerGroup | null>(null)
  const kmCountRef     = useRef<number>(0)

  // ── Initialize map once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: showFullRoute,   // allow panning in summary; lock during live run
      scrollWheelZoom: false,
    })

    // CartoDB dark tiles – matches app's dark theme perfectly
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map)

    // Route line: gold for summary review, blue for live tracking
    polyRef.current = L.polyline([], {
      color: showFullRoute ? '#f59e0b' : '#3b82f6',
      weight: showFullRoute ? 5 : 4,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)

    kmLayerRef.current = L.layerGroup().addTo(map)
    map.setView([48.1351, 11.582], 16)  // Munich default until GPS kicks in
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      polyRef.current = null
      posMarkerRef.current = null
      startMarkerRef.current = null
      kmLayerRef.current = null
      kmCountRef.current = 0
    }
  }, [showFullRoute])

  // ── Update route polyline + live position marker ──────────────────────────
  useEffect(() => {
    if (!mapRef.current || !polyRef.current || route.length === 0) return

    const latlngs = route.map(p => [p.lat, p.lng] as L.LatLngExpression)
    polyRef.current.setLatLngs(latlngs)

    const last = route[route.length - 1]

    // Live position: pulsing blue dot (Google Maps style)
    if (!showFullRoute) {
      if (posMarkerRef.current) {
        posMarkerRef.current.setLatLng([last.lat, last.lng])
      } else {
        const icon = L.divIcon({
          html: `
            <div style="position:relative;width:20px;height:20px">
              <div style="position:absolute;inset:0;background:rgba(59,130,246,0.25);border-radius:50%;animation:pulse 1.8s ease-in-out infinite"></div>
              <div style="position:absolute;top:3px;left:3px;width:14px;height:14px;background:#3b82f6;border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.6)"></div>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          className: '',
        })
        posMarkerRef.current = L.marker([last.lat, last.lng], { icon, zIndexOffset: 1000 }).addTo(mapRef.current)
      }
    }

    // Start marker: green flag-dot placed once
    if (!startMarkerRef.current) {
      const startIcon = L.divIcon({
        html: '<div style="width:12px;height:12px;background:#10b981;border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(16,185,129,0.5)"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        className: '',
      })
      startMarkerRef.current = L.marker([route[0].lat, route[0].lng], { icon: startIcon }).addTo(mapRef.current)
    }

    if (showFullRoute && route.length > 1) {
      mapRef.current.fitBounds(polyRef.current.getBounds(), { padding: [50, 50], animate: false })
    } else {
      // Smooth follow: only pan if runner has moved noticeably
      mapRef.current.setView([last.lat, last.lng], Math.max(17, mapRef.current.getZoom()), {
        animate: true,
        duration: 0.8,
        noMoveStart: true,
      })
    }
  }, [route, showFullRoute])

  // ── Add km markers incrementally (only new ones, never redraw) ────────────
  useEffect(() => {
    const layer = kmLayerRef.current
    if (!mapRef.current || !layer) return

    const newMarkers = kmMarkers.slice(kmCountRef.current)
    newMarkers.forEach(({ km, point }) => {
      const icon = L.divIcon({
        html: `
          <div style="
            width:24px;height:24px;
            background:${showFullRoute ? '#f59e0b' : '#1d4ed8'};
            border:2px solid #fff;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-size:9px;font-weight:900;color:#fff;
            box-shadow:0 2px 8px rgba(0,0,0,0.5)
          ">${km}</div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: '',
      })
      L.marker([point.lat, point.lng], { icon }).addTo(layer)
    })
    kmCountRef.current = kmMarkers.length
  }, [kmMarkers, showFullRoute])

  return <div ref={containerRef} className={className} style={style} />
}
