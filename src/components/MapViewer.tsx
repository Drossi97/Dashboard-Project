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
      // console.log('❌ No hay resultados válidos o intervalos')
      return []
    }

    const intervals = csvResults.data.intervals
    if (!Array.isArray(intervals)) {
      // console.log('❌ Los intervalos no son un array:', intervals)
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

    // console.log(`✅ Extraídos ${validIntervals.length} intervalos válidos de ${intervals.length} items`)
    return validIntervals
  } catch (error) {
    // console.error('❌ Error extrayendo intervalos:', error)
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

    // Agregar capa de tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map)

    mapInstanceRef.current = map
    // console.log('🗺️ Mapa inicializado')
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
      // console.log('❌ Mapa o Leaflet no disponible')
      return
    }

    try {
      clearMap()

      const L = window.L
      const allIntervals = extractIntervalsFromResults(csvResults)
      
      if (!allIntervals || allIntervals.length === 0) {
        // console.log('❌ No hay intervalos disponibles')
        return
      }

      const intervalsToShow = allIntervals.filter((interval: any) => {
        if (!interval || typeof interval.journeyIndex !== 'number') {
          // console.log('❌ Intervalo inválido:', interval)
          return false
        }
        // Usar journeyIndex para agrupar intervalos por trayecto
        return journeysToShow.has(interval.journeyIndex)
      })

      // console.log(`🗺️ Mostrando ${intervalsToShow.length} intervalos para trayectos:`, Array.from(journeysToShow))
      // console.log('🗺️ Intervalos a mostrar:', intervalsToShow)

      intervalsToShow.forEach((interval, intervalIndex) => {
        try {
          const intervalNumber = interval.intervalNumber
          const journeyIndex = interval.journeyIndex || intervalNumber // fallback
          const intervalColor = getJourneyColor(journeyIndex)

          // console.log(`🗺️ Procesando intervalo ${intervalNumber} del trayecto ${journeyIndex}`)

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

            startMarker.bindPopup(`
              <div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4;">
                <strong>Trayecto ${journeyIndex}</strong><br/>
                <strong>Intervalo:</strong> ${intervalIndex + 1}<br/>
                <strong>Fecha:</strong> ${interval.startTime ? new Date(interval.startTime).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}<br/>
                <strong>Inicio:</strong> ${interval.startTime ? new Date(interval.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A'}<br/>
                <strong>Final:</strong> ${interval.endTime ? new Date(interval.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A'}<br/>
                <strong>Estado:</strong> ${interval.classificationType || 'N/A'}<br/>
                <strong>Velocidad media:</strong> ${interval.avgSpeed?.toFixed(1) || 'N/A'} km/h<br/>
                <strong>Duración:</strong> ${interval.duration}
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

                polyline.bindPopup(`
                  <div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4;">
                    <strong>Trayecto ${journeyIndex}</strong><br/>
                    <strong>Intervalo:</strong> ${intervalIndex + 1}<br/>
                    <strong>Fecha:</strong> ${interval.startTime ? new Date(interval.startTime).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}<br/>
                    <strong>Inicio:</strong> ${interval.startTime ? new Date(interval.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A'}<br/>
                    <strong>Final:</strong> ${interval.endTime ? new Date(interval.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A'}<br/>
                    <strong>Estado:</strong> ${interval.classificationType || 'N/A'}<br/>
                    <strong>Velocidad media:</strong> ${interval.avgSpeed?.toFixed(1) || 'N/A'} km/h<br/>
                    <strong>Duración:</strong> ${interval.duration}
                  </div>
                `)

                polyline.addTo(mapInstanceRef.current)
                polylinesRef.current.push(polyline)
              } catch (error) {
                // console.error('Error creando polyline:', error)
              }
            }
          }
        } catch (error) {
          // console.error(`❌ Error procesando intervalo ${intervalIndex + 1}:`, error)
        }
      })

      // Ajustar vista del mapa para mostrar todos los trayectos
      if (intervalsToShow.length > 0 && markersRef.current.length > 0) {
        try {
          const group = new L.featureGroup([...markersRef.current, ...polylinesRef.current])
          mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1))
        } catch (error) {
          // console.error('❌ Error ajustando vista del mapa:', error)
        }
      }
    } catch (error) {
      // console.error('❌ Error en showSelectedJourneys:', error)
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
