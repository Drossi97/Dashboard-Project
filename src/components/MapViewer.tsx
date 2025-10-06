import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState } from "react"
import "../styles/map.css"
import { CSVIntervalResult } from "../hooks/useCSVInterval"
import { getJourneyColor } from "../lib/colors"

// Declarar tipos para Leaflet
declare global {
  interface Window {
    L: any
  }
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
  
  const gray = r * 0.299 + g * 0.587 + b * 0.114
  const newR = Math.min(255, Math.max(0, Math.round(gray + (r - gray) * factor)))
  const newG = Math.min(255, Math.max(0, Math.round(gray + (g - gray) * factor)))
  const newB = Math.min(255, Math.max(0, Math.round(gray + (b - gray) * factor)))
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
}

// Función para ajustar el matiz de un color
const adjustColorHue = (color: string, degrees: number): string => {
  const hex = color.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16) / 255
  const g = parseInt(hex.substr(2, 2), 16) / 255
  const b = parseInt(hex.substr(4, 2), 16) / 255
  
  // Convertir RGB a HSL
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  
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
  
  // Ajustar matiz
  h = (h + degrees / 360) % 1
  if (h < 0) h += 1
  
  // Convertir HSL a RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  
  let newR, newG, newB
  if (s === 0) {
    newR = newG = newB = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    newR = hue2rgb(p, q, h + 1/3)
    newG = hue2rgb(p, q, h)
    newB = hue2rgb(p, q, h - 1/3)
  }
  
  return `#${Math.round(newR * 255).toString(16).padStart(2, '0')}${Math.round(newG * 255).toString(16).padStart(2, '0')}${Math.round(newB * 255).toString(16).padStart(2, '0')}`
}

interface MapViewerProps {
  csvResults: CSVIntervalResult | null
  selectedJourneys: Set<number>
}

export interface MapViewerRef {
  clearMap: () => void
  showSelectedJourneys: (journeysToShow: Set<number>) => void
}

// Función para extraer intervalos válidos desde los resultados de CSV
const extractIntervalsFromResults = (csvResults: CSVIntervalResult | null) => {
  try {
    if (!csvResults?.success || !csvResults.data?.intervals) {
      return []
    }

    const intervals = csvResults.data.intervals
    if (!Array.isArray(intervals)) {
      return []
    }

    // Filtrar solo los intervalos reales (no los separadores)
    const validIntervals = intervals.filter((item: any) => {
      if (!item || typeof item !== 'object') {
        return false
      }
      
      if (item.separator) {
        return false // Es un separador, no un intervalo
      }
      
      // Verificar que tenga las propiedades necesarias - usar journeyIndex
      if (typeof item.journeyIndex !== 'number') {
        return false
      }
      
      return true
    })

    return validIntervals
  } catch (error) {
    return []
  }
}

const MapViewer = forwardRef<MapViewerRef, MapViewerProps>(({ csvResults, selectedJourneys }, ref) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const polylinesRef = useRef<any[]>([])
  const [isMapLoaded, setIsMapLoaded] = useState(false)

  // Cargar Leaflet dinámicamente
  useEffect(() => {
    const loadLeaflet = async () => {
      if (typeof window !== 'undefined' && !window.L) {
        const L = await import('leaflet')
        window.L = L.default
        
        // Configurar iconos por defecto
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        })
      }
      setIsMapLoaded(true)
    }

    loadLeaflet()
  }, [])

  // Inicializar mapa
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || mapInstanceRef.current) return

    const L = window.L
    if (!L) return

    // Crear mapa centrado en el Estrecho de Gibraltar
    const map = L.map(mapRef.current, {
      zoomControl: false,
      minZoom: 10,  // Límite mínimo: vista regional del Estrecho de Gibraltar
      maxZoom: 18   // Límite máximo de acercamiento (zoom in)
    }).setView([36.0, -5.4], 10)

    // Configurar z-index del contenedor del mapa
    const mapContainer = map.getContainer()
    if (mapContainer) {
      mapContainer.style.zIndex = '1'
    }

    // Agregar capa de tiles - Mapa con colores para la tierra
    // Opción 1: CartoDB Positron (muy limpio, minimalista)
    // L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    //   attribution: '© OpenStreetMap contributors © CARTO',
    //   subdomains: 'abcd',
    //   maxZoom: 19
    // }).addTo(map)

    // Opciones alternativas (descomenta la que prefieras):
    
    // Opción 2: CartoDB Voyager (limpio con colores suaves para la tierra) ⭐ ACTIVO
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map)

    // Opción 3: Stamen Toner Lite (blanco y negro, muy limpio)
    // L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}{r}.png', {
    //   attribution: 'Map tiles by Stamen Design, CC BY 3.0 — Map data © OpenStreetMap contributors',
    //   subdomains: 'abcd',
    //   maxZoom: 20
    // }).addTo(map)

    // Opción 4: Mapbox Light (muy profesional, requiere API key)
    // L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/light-v10/tiles/{z}/{x}/{y}?access_token=TU_API_KEY', {
    //   attribution: '© Mapbox © OpenStreetMap contributors',
    //   maxZoom: 20
    // }).addTo(map)

    // Opción 5: Esri World Street Map (limpio y profesional)
    // L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    //   attribution: 'Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012',
    //   maxZoom: 19
    // }).addTo(map)

    // Opción 6: Stamen Terrain (colores naturales para la tierra)
    // L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png', {
    //   attribution: 'Map tiles by Stamen Design, CC BY 3.0 — Map data © OpenStreetMap contributors',
    //   subdomains: 'abcd',
    //   maxZoom: 18
    // }).addTo(map)

    // Opción 7: CartoDB Dark Matter (oscuro pero con colores)
    // L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    //   attribution: '© OpenStreetMap contributors © CARTO',
    //   subdomains: 'abcd',
    //   maxZoom: 19
    // }).addTo(map)

    // Opción 8: OpenTopoMap (colores naturales y topográficos)
    // L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    //   attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
    //   maxZoom: 17
    // }).addTo(map)

    mapInstanceRef.current = map
  }, [isMapLoaded])

  // Limpiar marcadores y polylines
  const clearMap = () => {
    markersRef.current.forEach(marker => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(marker)
      }
    })
    polylinesRef.current.forEach(polyline => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(polyline)
      }
    })
    markersRef.current = []
    polylinesRef.current = []
  }

  // Mostrar trayectos seleccionados
  const showSelectedJourneys = (journeysToShow: Set<number>) => {
    if (!mapInstanceRef.current || !window.L) {
      return
    }

    try {
      clearMap()

      const L = window.L
      const allIntervals = extractIntervalsFromResults(csvResults)
      
      if (!allIntervals || allIntervals.length === 0) {
        return
      }

      const intervalsToShow = allIntervals.filter((interval: any) => {
        if (!interval || typeof interval.journeyIndex !== 'number') {
          return false
        }
        // Usar journeyIndex para agrupar intervalos por trayecto
        return journeysToShow.has(interval.journeyIndex)
      })


      intervalsToShow.forEach((interval, intervalIndex) => {
        try {
          const intervalNumber = interval.intervalNumber
          const journeyIndex = interval.journeyIndex || intervalNumber // fallback
          const intervalColor = getJourneyColor(journeyIndex)


          // Crear marcador de inicio
          if (interval.startLat && interval.startLon && 
              !isNaN(interval.startLat) && !isNaN(interval.startLon)) {
            const startMarker = L.marker([interval.startLat, interval.startLon], {
              icon: L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${intervalColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
              })
            })

            // Crear el contenido del popup con la misma estructura que IntervalStats
            const startTime = interval.startTime ? new Date(interval.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A'
            const endTime = interval.endTime ? new Date(interval.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A'
            const date = interval.startTime ? new Date(interval.startTime).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A'
            const navStatusValue = parseFloat(interval.navStatus || '0.0')
            
            startMarker.bindPopup(`
              <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #000000; background-color: #FFFFFF; border: 1px solid #374151; border-radius: 8px; padding: 12px;">
                <!-- Datos de los ejes (prioridad) -->
                <div style="border-bottom: 1px solid #374151; padding-bottom: 10px; margin-bottom: 10px;">
                  <div style="color: #3B82F6; font-weight: bold; font-size: 15px;">Velocidad: ${interval.avgSpeed?.toFixed(2) || 'N/A'} nudos</div>
                  <div style="color: #10B981; font-weight: bold; font-size: 15px;">Estado: ${navStatusValue}</div>
                  <div style="color: #000000; font-size: 14px;">Hora: ${startTime}</div>
                  <div style="color: #000000; font-size: 14px;">Día: ${date}</div>
                </div>
                
                <!-- Datos del intervalo -->
                <div style="font-size: 13px;">
                  <div style="display: flex; gap: 16px;">
                    <span><span style="color: #000000; font-weight: 500;">Trayecto:</span> <span style="color: #6B7280;">${journeyIndex}</span></span>
                    <span><span style="color: #000000; font-weight: 500;">Intervalo:</span> <span style="color: #6B7280;">${interval.intervalNumber}</span></span>
                  </div>
                  <div style="margin-top: 6px;"><span style="color: #000000; font-weight: 500;">Actividad:</span> <span style="color: #6B7280;">${interval.classificationType || 'N/A'}</span></div>
                  <div style="margin-top: 10px;">
                    <div style="margin-bottom: 4px;"><span style="color: #000000; font-weight: 500;">Hora de comienzo:</span> <span style="color: #6B7280;">${startTime}</span></div>
                    <div style="margin-bottom: 4px;"><span style="color: #000000; font-weight: 500;">Hora de finalización:</span> <span style="color: #6B7280;">${endTime}</span></div>
                    <div><span style="color: #000000; font-weight: 500;">Duración:</span> <span style="color: #6B7280;">${interval.duration || 'N/A'}</span></div>
                  </div>
                </div>
              </div>
            `)

            startMarker.addTo(mapInstanceRef.current)
            markersRef.current.push(startMarker)
          }

          // Crear polyline para este intervalo
          if (interval.coordinatePoints && interval.coordinatePoints.length > 1) {
            const intervalCoordinates: [number, number][] = []
            
            interval.coordinatePoints.forEach((point: any) => {
              if (point.lat && point.lon && !isNaN(point.lat) && !isNaN(point.lon)) {
                intervalCoordinates.push([point.lat, point.lon])
              }
            })

            if (intervalCoordinates.length > 1) {
              try {
                const polyline = L.polyline(intervalCoordinates, {
                  color: intervalColor,
                  weight: 3,
                  opacity: 0.8,
                  smoothFactor: 1
                })

                // Crear el contenido del popup con la misma estructura que IntervalStats
                const startTime = interval.startTime ? new Date(interval.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A'
                const endTime = interval.endTime ? new Date(interval.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A'
                const date = interval.startTime ? new Date(interval.startTime).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A'
                const navStatusValue = parseFloat(interval.navStatus || '0.0')
                
                polyline.bindPopup(`
                  <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #000000; background-color: #FFFFFF; border: 1px solid #374151; border-radius: 8px; padding: 12px;">
                    <!-- Datos de los ejes (prioridad) -->
                    <div style="border-bottom: 1px solid #374151; padding-bottom: 10px; margin-bottom: 10px;">
                      <div style="color: #3B82F6; font-weight: bold; font-size: 15px;">Velocidad: ${interval.avgSpeed?.toFixed(2) || 'N/A'} nudos</div>
                      <div style="color: #10B981; font-weight: bold; font-size: 15px;">Estado: ${navStatusValue}</div>
                      <div style="color: #000000; font-size: 14px;">Hora: ${startTime}</div>
                      <div style="color: #000000; font-size: 14px;">Día: ${date}</div>
                    </div>
                    
                    <!-- Datos del intervalo -->
                    <div style="font-size: 13px;">
                      <div style="display: flex; gap: 16px;">
                        <span><span style="color: #000000; font-weight: 500;">Trayecto:</span> <span style="color: #6B7280;">${journeyIndex}</span></span>
                        <span><span style="color: #000000; font-weight: 500;">Intervalo:</span> <span style="color: #6B7280;">${interval.intervalNumber}</span></span>
                      </div>
                      <div style="margin-top: 6px;"><span style="color: #000000; font-weight: 500;">Actividad:</span> <span style="color: #6B7280;">${interval.classificationType || 'N/A'}</span></div>
                      <div style="margin-top: 10px;">
                        <div style="margin-bottom: 4px;"><span style="color: #000000; font-weight: 500;">Hora de comienzo:</span> <span style="color: #6B7280;">${startTime}</span></div>
                        <div style="margin-bottom: 4px;"><span style="color: #000000; font-weight: 500;">Hora de finalización:</span> <span style="color: #6B7280;">${endTime}</span></div>
                        <div><span style="color: #000000; font-weight: 500;">Duración:</span> <span style="color: #6B7280;">${interval.duration || 'N/A'}</span></div>
                      </div>
                    </div>
                  </div>
                `)

                polyline.addTo(mapInstanceRef.current)
                polylinesRef.current.push(polyline)
              } catch (error) {
              }
            }
          }
        } catch (error) {
        }
      })

      // Ajustar vista del mapa para mostrar todos los trayectos
      if (intervalsToShow.length > 0 && markersRef.current.length > 0) {
        try {
          const group = new L.featureGroup([...markersRef.current, ...polylinesRef.current])
          mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1))
        } catch (error) {
        }
      }
    } catch (error) {
    }
  }

  // Exponer métodos a través de ref
  useImperativeHandle(ref, () => ({
    clearMap,
    showSelectedJourneys
  }))

  // Actualizar mapa cuando cambien los trayectos seleccionados
  useEffect(() => {
    if (mapInstanceRef.current && selectedJourneys.size > 0) {
      showSelectedJourneys(selectedJourneys)
    } else if (mapInstanceRef.current && selectedJourneys.size === 0) {
      clearMap()
    }
  }, [selectedJourneys, csvResults])

  return (
    <div className="w-full h-full bg-white">
      <div ref={mapRef} className="w-full h-full bg-white" />
    </div>
  )
})

MapViewer.displayName = 'MapViewer'

export default MapViewer
