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
      dragging: showFullRoute,
      scrollWheelZoom: false,
    })

    // CartoDB dark tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map)

    // Route line: gold always (Kalorilo brand color)
    polyRef.current = L.polyline([], {
      color: '#f59e0b',
      weight: showFullRoute ? 5 : 4,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)

    kmLayerRef.current = L.layerGroup().addTo(map)
    map.setView([48.1351, 11.582], 16)
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

    const latlngs = route.map((p) => [p.lat, p.lng] as L.LatLngExpression)
    polyRef.current.setLatLngs(latlngs)

    const last = route[route.length - 1]

    // Live position: pulsing gold dot
    if (!showFullRoute) {
      if (posMarkerRef.current) {
        posMarkerRef.current.setLatLng([last.lat, last.lng])
      } else {
        const icon = L.divIcon({
          html: `
            <div style="position:relative;width:22px;height:22px">
              <div style="position:absolute;inset:0;background:rgba(245,158,11,0.3);border-radius:50%;animation:pulse 1.8s ease-in-out infinite"></div>
              <div style="position:absolute;top:3px;left:3px;width:16px;height:16px;background:#f59e0b;border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 10px rgba(245,158,11,0.7)"></div>
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          className: '',
        })
        posMarkerRef.current = L.marker([last.lat, last.lng], { icon, zIndexOffset: 1000 }).addTo(mapRef.current)
      }
    }

    // Start marker: green dot placed once
    if (!startMarkerRef.current) {
      const startIcon = L.divIcon({
        html: '<div style="width:12px;height:12px;background:#10b981;border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(16,185,129,0.6)"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        className: '',
      })
      startMarkerRef.current = L.marker([route[0].lat, route[0].lng], { icon: startIcon }).addTo(mapRef.current)
    }

    if (showFullRoute && route.length > 1) {
      mapRef.current.fitBounds(polyRef.current.getBounds(), { padding: [50, 50], animate: false })
    } else {
      mapRef.current.setView([last.lat, last.lng], Math.max(17, mapRef.current.getZoom()), {
        animate: true,
        duration: 0.8,
        noMoveStart: true,
      })
    }
  }, [route, showFullRoute])

  // ── Add km markers incrementally (only new ones) ──────────────────────────
  useEffect(() => {
    const layer = kmLayerRef.current
    if (!mapRef.current || !layer) return

    const newMarkers = kmMarkers.slice(kmCountRef.current)
    newMarkers.forEach(({ km, point }) => {
      const icon = L.divIcon({
        html: `
          <div style="
            width:26px;height:26px;
            background:#f59e0b;
            border:2px solid #fff;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-size:9px;font-weight:900;color:#000;
            box-shadow:0 2px 10px rgba(245,158,11,0.6)
          ">${km}</div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        className: '',
      })
      L.marker([point.lat, point.lng], { icon }).addTo(layer)
    })
    kmCountRef.current = kmMarkers.length
  }, [kmMarkers])

  return <div ref={containerRef} className={className} style={style} />
}
