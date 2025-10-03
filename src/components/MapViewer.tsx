import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState } from "react"
import "../styles/map.css"

// Declarar tipos para Leaflet
declare global {
  interface Window {
    L: any
  }
}

// Colores base para los trayectos
const JOURNEY_BASE_COLORS = [
  '#FF4444', // Rojo brillante
  '#00AA44', // Verde oscuro
  '#0066CC', // Azul oscuro
  '#FF8800', // Naranja brillante
  '#8800AA', // Morado oscuro
  '#CC6600', // Marrón oscuro
  '#00AAAA', // Cian oscuro
  '#AA4400', // Rojo oscuro
  '#0044AA', // Azul muy oscuro
  '#AA0088'  // Magenta oscuro
]

// Función para generar colores específicos para cada intervalo
const getIntervalColor = (journeyIndex: number, intervalIndex: number): string => {
  const baseColor = JOURNEY_BASE_COLORS[journeyIndex % JOURNEY_BASE_COLORS.length]
  
  // Crear variaciones del color base para cada intervalo
  const variations = [
    baseColor, // Color base
    adjustColorBrightness(baseColor, 0.7), // Más oscuro
    adjustColorBrightness(baseColor, 1.3), // Más claro
    adjustColorSaturation(baseColor, 0.8), // Menos saturado
    adjustColorSaturation(baseColor, 1.2), // Más saturado
    adjustColorHue(baseColor, 30), // Cambio de matiz
    adjustColorHue(baseColor, -30), // Cambio de matiz opuesto
    adjustColorBrightness(baseColor, 0.5), // Muy oscuro
  ]
  
  return variations[intervalIndex % variations.length]
}

// Función para ajustar el brillo de un color
const adjustColorBrightness = (color: string, factor: number): string => {
  const hex = color.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  const newR = Math.min(255, Math.max(0, Math.round(r * factor)))
  const newG = Math.min(255, Math.max(0, Math.round(g * factor)))
  const newB = Math.min(255, Math.max(0, Math.round(b * factor)))
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
}

// Función para ajustar la saturación de un color
const adjustColorSaturation = (color: string, factor: number): string => {
  const hex = color.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  // Convertir a HSL, ajustar saturación, convertir de vuelta a RGB
  const hsl = rgbToHsl(r, g, b)
  const newS = Math.min(1, Math.max(0, hsl.s * factor))
  const rgb = hslToRgb(hsl.h, newS, hsl.l)
  
  return `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`
}

// Función para ajustar el matiz de un color
const adjustColorHue = (color: string, degrees: number): string => {
  const hex = color.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  const hsl = rgbToHsl(r, g, b)
  const newH = (hsl.h + degrees) % 360
  const rgb = hslToRgb(newH, hsl.s, hsl.l)
  
  return `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`
}

// Funciones auxiliares para conversión de color
const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255
  g /= 255
  b /= 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  
  return { h: h * 360, s, l }
}

const hslToRgb = (h: number, s: number, l: number) => {
  h /= 360
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  
  let r, g, b
  
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

interface CoordinatePoint {
  lat: number
  lon: number
  timestamp: string
  speed: number | null
  navStatus: string
}

interface EnhancedDataInterval {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  navStatus: string
  duration: string
  avgSpeed: number | null
  sampleCount: number
  startLat: number | null
  startLon: number | null
  endLat: number | null
  endLon: number | null
  endReason: string
  startPort?: { name: string; distance: number }
  endPort?: { name: string; distance: number }
  journeyIndex?: number | null
  classificationType?: string
  coordinates: CoordinatePoint[]
  totalDistance?: number
}

interface MapViewerProps {
  intervals: EnhancedDataInterval[]
  selectedJourneys: Set<number>
}

export interface MapViewerRef {
  clearMap: () => void
  showSelectedJourneys: (journeysToShow: Set<number>) => void
}

const MapViewer = forwardRef<MapViewerRef, MapViewerProps>(({ intervals, selectedJourneys }, ref) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const polylinesRef = useRef<any[]>([])
  const [isMapLoaded, setIsMapLoaded] = useState(false)

  // Exponer funciones al componente padre
  useImperativeHandle(ref, () => ({
    clearMap: () => {
      if (mapInstanceRef.current) {
        markersRef.current.forEach(marker => mapInstanceRef.current?.removeLayer(marker))
        polylinesRef.current.forEach(polyline => mapInstanceRef.current?.removeLayer(polyline))
      }
      markersRef.current = []
      polylinesRef.current = []
    },
    showSelectedJourneys: (journeysToShow: Set<number>) => {
      showSelectedJourneys(journeysToShow)
    }
  }))

  // Cargar Leaflet dinámicamente
  useEffect(() => {
    const loadLeaflet = async () => {
      if (typeof window !== 'undefined' && !window.L) {
        try {
          // Cargar CSS
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)

          // Cargar JS
          const script = document.createElement('script')
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
          script.onload = () => {
            console.log('Leaflet cargado exitosamente')
            initializeMap()
          }
          script.onerror = () => {
            console.error('Error cargando Leaflet desde unpkg, intentando con CDN alternativo...')
            // Fallback CDN
            const fallbackScript = document.createElement('script')
            fallbackScript.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'
            fallbackScript.onload = () => {
              console.log('Leaflet cargado desde CDN alternativo')
              initializeMap()
            }
            document.head.appendChild(fallbackScript)
          }
          document.head.appendChild(script)
        } catch (error) {
          console.error('Error cargando Leaflet:', error)
        }
      } else if (window.L) {
        initializeMap()
      }
    }

    const initializeMap = () => {
      if (mapRef.current && window.L && !mapInstanceRef.current) {
        try {
          // Crear mapa centrado en el Estrecho de Gibraltar
          mapInstanceRef.current = window.L.map(mapRef.current, {
            center: [36.0, -5.4],
            zoom: 10,
            zoomControl: false,
            attributionControl: true
          })

          // Agregar capa de tiles
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(mapInstanceRef.current)

          // Forzar redimensionamiento
          setTimeout(() => {
            mapInstanceRef.current?.invalidateSize()
          }, 100)

          setIsMapLoaded(true)
          console.log('Mapa inicializado correctamente')
        } catch (error) {
          console.error('Error inicializando mapa:', error)
        }
      }
    }

    loadLeaflet()
  }, [])

  // Mostrar trayectos seleccionados cuando cambien
  useEffect(() => {
    if (isMapLoaded && intervals.length > 0) {
      showSelectedJourneys(selectedJourneys)
    }
  }, [selectedJourneys, intervals, isMapLoaded])

  const showSelectedJourneys = (journeysToShow: Set<number>) => {
    console.log(`=== MOSTRANDO TRAYECTOS: ${Array.from(journeysToShow).join(', ')} ===`)
    console.log('🔍 mapInstanceRef.current:', !!mapInstanceRef.current)
    console.log('🔍 intervals.length:', intervals.length)
    console.log('🔍 journeysToShow.size:', journeysToShow.size)
    
    if (!mapInstanceRef.current || !intervals.length) {
      console.log('❌ No se pueden mostrar trayectos: condiciones no cumplidas')
      return
    }

    // Limpiar mapa primero
    markersRef.current.forEach(marker => mapInstanceRef.current?.removeLayer(marker))
    polylinesRef.current.forEach(polyline => mapInstanceRef.current?.removeLayer(polyline))
    markersRef.current = []
    polylinesRef.current = []

    if (journeysToShow.size === 0) {
      console.log('No hay trayectos seleccionados')
      return
    }

    // Mostrar cada trayecto seleccionado
    journeysToShow.forEach(journeyIndex => {
      console.log(`🔍 Procesando trayecto ${journeyIndex}`)
      const journeyIntervals = intervals.filter(interval => interval.journeyIndex === journeyIndex)
      
      console.log(`Trayecto ${journeyIndex}: ${journeyIntervals.length} intervalos`)
      console.log('🔍 journeyIntervals:', journeyIntervals)
      
      if (journeyIntervals.length === 0) {
        console.log(`❌ No hay intervalos para trayecto ${journeyIndex}`)
        return
      }

      console.log(`🔍 Procesando trayecto ${journeyIndex} con ${journeyIntervals.length} intervalos`)

      // Crear marcadores y polylines para cada intervalo individualmente
      journeyIntervals.forEach((interval, intervalIndex) => {
        const intervalColor = getIntervalColor(journeyIndex, intervalIndex)
        console.log(`🔍 Color para trayecto ${journeyIndex}, intervalo ${intervalIndex}: ${intervalColor}`)

        // Crear marcador para el inicio del intervalo
        if (interval.startLat && interval.startLon) {
          const marker = window.L.circleMarker([interval.startLat, interval.startLon], {
            radius: 8,
            fillColor: intervalColor,
            color: '#fff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9
          }).addTo(mapInstanceRef.current)

          marker.bindPopup(`
            <div class="text-sm">
              <strong>Trayecto ${journeyIndex + 1}</strong><br/>
              <strong>Intervalo:</strong> ${intervalIndex + 1}<br/>
              <strong>Estado:</strong> ${interval.navStatus}<br/>
              <strong>Duración:</strong> ${interval.duration}<br/>
              <strong>Velocidad:</strong> ${interval.avgSpeed?.toFixed(1) || 'N/A'} km/h<br/>
              <strong>Puerto:</strong> ${interval.startPort?.name || 'N/A'}<br/>
              <strong>Puntos:</strong> ${interval.coordinates.length}<br/>
              <strong>Distancia:</strong> ${interval.totalDistance?.toFixed(2) || 'N/A'} km<br/>
              <strong>Color:</strong> <span style="color: ${intervalColor}">●</span> ${intervalColor}
            </div>
          `)

          markersRef.current.push(marker)
        }

        // Crear polyline para este intervalo específico
        if (interval.coordinates.length > 1) {
          const intervalCoordinates: [number, number][] = []
          
          interval.coordinates.forEach(point => {
            if (point.lat && point.lon && !isNaN(point.lat) && !isNaN(point.lon)) {
              intervalCoordinates.push([point.lat, point.lon])
            }
          })

          if (intervalCoordinates.length > 1) {
            try {
              const polyline = window.L.polyline(intervalCoordinates, {
                color: intervalColor,
                weight: 6,
                opacity: 0.9,
                smoothFactor: 1
              }).addTo(mapInstanceRef.current)

              polylinesRef.current.push(polyline)
              console.log(`✅ Trayecto ${journeyIndex}, Intervalo ${intervalIndex}: ${intervalCoordinates.length} puntos, polyline creado con color ${intervalColor}`)
            } catch (error) {
              console.error(`❌ Error creando polyline para trayecto ${journeyIndex}, intervalo ${intervalIndex}:`, error)
            }
          }
        }
      })
    })

    console.log(`=== ${journeysToShow.size} TRAYECTOS MOSTRADOS ===`)
  }

  return (
    <div className="absolute inset-0 z-0">
      <div 
        ref={mapRef} 
        className="w-full h-full"
        style={{ minHeight: '100%', backgroundColor: '#e5e7eb' }}
      />
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando mapa...</p>
          </div>
        </div>
      )}
    </div>
  )
})

MapViewer.displayName = 'MapViewer'

export default MapViewer
