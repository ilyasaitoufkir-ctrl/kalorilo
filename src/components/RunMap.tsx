import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeoPoint } from '../types'

// Fix Leaflet default marker icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: '', iconRetinaUrl: '', shadowUrl: '' })

interface Props {
  route: GeoPoint[]
  showFullRoute?: boolean  // fit all points into view (for summary)
  style?: React.CSSProperties
  className?: string
}

export default function RunMap({ route, showFullRoute = false, style, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const polyRef      = useRef<L.Polyline | null>(null)
  const dotRef       = useRef<L.Marker | null>(null)
  const startDotRef  = useRef<L.Marker | null>(null)

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    })

    // CartoDB dark tiles – fits the app's dark theme
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map)

    polyRef.current = L.polyline([], {
      color: '#10b981',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)

    map.setView([48.1351, 11.5820], 15) // Munich default until GPS kicks in
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      polyRef.current = null
      dotRef.current = null
      startDotRef.current = null
    }
  }, [])

  // Update route polyline and markers
  useEffect(() => {
    if (!mapRef.current || !polyRef.current || route.length === 0) return

    const latlngs = route.map(p => [p.lat, p.lng] as L.LatLngExpression)
    polyRef.current.setLatLngs(latlngs)

    const last = route[route.length - 1]

    // Current position dot (green pulsing circle)
    if (dotRef.current) {
      dotRef.current.setLatLng([last.lat, last.lng])
    } else {
      const icon = L.divIcon({
        html: '<div style="width:14px;height:14px;background:#10b981;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 6px rgba(16,185,129,0.25)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: '',
      })
      dotRef.current = L.marker([last.lat, last.lng], { icon }).addTo(mapRef.current)
    }

    // Start marker (blue dot, only placed once)
    if (!startDotRef.current) {
      const startIcon = L.divIcon({
        html: '<div style="width:12px;height:12px;background:#3b82f6;border:3px solid #fff;border-radius:50%"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        className: '',
      })
      startDotRef.current = L.marker([route[0].lat, route[0].lng], { icon: startIcon }).addTo(mapRef.current)
    }

    if (showFullRoute && route.length > 1) {
      mapRef.current.fitBounds(polyRef.current.getBounds(), { padding: [40, 40], animate: false })
    } else {
      mapRef.current.setView([last.lat, last.lng], Math.max(16, mapRef.current.getZoom()), {
        animate: true,
        duration: 0.8,
      })
    }
  }, [route, showFullRoute])

  return <div ref={containerRef} className={className} style={style} />
}
