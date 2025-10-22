import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState } from "react"
import { CSVIntervalResult } from "../hooks/useCSVInterval"
import { getJourneyColor } from "../lib/colors"

// Declarar tipos para Leaflet
declare global {
  interface Window {
    L: any
  }
}

interface MapViewerProps {
  csvResults: CSVIntervalResult | null
  selectedJourneys: Set<number>
}

export interface MapViewerRef {
  clearMap: () => void
  showSelectedJourneys: (journeysToShow: Set<number>) => void
}

const MapViewer = forwardRef<MapViewerRef, MapViewerProps>(({ csvResults, selectedJourneys }, ref) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const polylinesRef = useRef<any[]>([])
  const tooltipRef = useRef<any>(null)
  const proximityActiveRef = useRef<boolean>(false)
  const currentPolylineRef = useRef<any>(null)
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
      minZoom: 10,
      maxZoom: 18
    }).setView([36.0, -5.4], 10)

    // Agregar capa de tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: false,
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map)

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
    if (tooltipRef.current) {
      mapInstanceRef.current?.removeLayer(tooltipRef.current)
      tooltipRef.current = null
    }
    proximityActiveRef.current = false
    currentPolylineRef.current = null
    markersRef.current = []
    polylinesRef.current = []
  }

  // Función para extraer intervalos válidos desde los resultados de CSV
  const extractIntervalsFromResults = (csvResults: CSVIntervalResult | null) => {
    if (!csvResults?.success || !csvResults.data?.journeys) {
      return []
    }

    const journeys = csvResults.data.journeys
    if (!Array.isArray(journeys)) {
      return []
    }

    // Extraer todos los intervalos de todos los journeys
    const allIntervals: any[] = []
    journeys.forEach((journey) => {
      if (journey.intervals && Array.isArray(journey.intervals)) {
        journey.intervals.forEach((interval) => {
          if (interval && typeof interval === 'object' && typeof interval.journeyIndex === 'number') {
            allIntervals.push(interval)
          }
        })
      }
    })

    return allIntervals
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

      // Filtrar intervalos de los trayectos seleccionados
      const intervalsToShow = allIntervals.filter((interval: any) => {
        if (!interval || typeof interval.journeyIndex !== 'number') {
          return false
        }
        return journeysToShow.has(interval.journeyIndex)
      })


      // Dibujar cada intervalo
      intervalsToShow.forEach((interval: any) => {
        const journeyIndex = interval.journeyIndex
          const intervalColor = getJourneyColor(journeyIndex)

          // Crear polyline para este intervalo
          if (interval.coordinatePoints && interval.coordinatePoints.length > 1) {
            const intervalCoordinates: [number, number][] = []
            
            interval.coordinatePoints.forEach((point: any) => {
              if (point.lat && point.lon && !isNaN(point.lat) && !isNaN(point.lon)) {
                intervalCoordinates.push([point.lat, point.lon])
              }
            })

            if (intervalCoordinates.length > 1) {
                const polyline = L.polyline(intervalCoordinates, {
                  color: intervalColor,
                  weight: 3,
                  opacity: 0.8,
                  smoothFactor: 1
                })

                // Función para formatear duración sin mostrar 0h y sin segundos
                const formatDuration = (duration: string): string => {
                  if (!duration) return 'N/A'
                  
                  // Remover segundos del formato (ej: "1h 5m 26s" -> "1h 5m")
                  let formattedDuration = duration.replace(/\s*\d+s/g, '')
                  
                  // Si contiene "0h", removerlo
                  if (formattedDuration.includes('0h')) {
                    formattedDuration = formattedDuration.replace('0h ', '').trim()
                  }
                  
                  return formattedDuration
                }

                // Preparar información del intervalo para el tooltip
                const startTime = interval.startTime ? new Date(interval.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'h' : 'N/A'
                const endTime = interval.endTime ? new Date(interval.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'h' : 'N/A'
                const date = interval.startTime ? new Date(interval.startTime).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A'

                // Agregar marcadores de inicio y fin del intervalo
                const startPoint = intervalCoordinates[0]
                const endPoint = intervalCoordinates[intervalCoordinates.length - 1]
                
                // Marcador de inicio (color del trayecto - completo)
                const startMarker = L.circleMarker(startPoint, {
                  radius: 6,
                  fillColor: intervalColor,
                  color: '#FFFFFF',
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.8
                }).addTo(mapInstanceRef.current)
                
                // Marcador de fin (color del trayecto - completo)
                const endMarker = L.circleMarker(endPoint, {
                  radius: 6,
                  fillColor: intervalColor,
                  color: '#FFFFFF',
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.8
                }).addTo(mapInstanceRef.current)
                
                
                // Guardar marcadores para poder limpiarlos después
                markersRef.current.push(startMarker, endMarker)

            
            // Función para generar contenido del tooltip con datos del punto específico
            const generateTooltipContent = (pointLatLng: any, interval: any) => {
              // Calcular la posición relativa del punto en la trayectoria (0-100%)
              const totalPoints = interval.coordinatePoints.length
              let closestPointIndex = 0
              let minDistance = Infinity
              
              // Encontrar el punto más cercano en la trayectoria
              interval.coordinatePoints.forEach((point: any, index: number) => {
                if (point.lat && point.lon) {
                  const distance = mapInstanceRef.current.distance(pointLatLng, [point.lat, point.lon])
                  if (distance < minDistance) {
                    minDistance = distance
                    closestPointIndex = index
                  }
                }
              })
              
              // Calcular progreso en la trayectoria (0-100%)
              const progress = totalPoints > 1 ? (closestPointIndex / (totalPoints - 1)) * 100 : 0
              
              // Verificar si es el último intervalo del trayecto y si estamos en el punto final
              const isLastIntervalOfJourney = intervalsToShow.filter(i => i.journeyIndex === interval.journeyIndex).indexOf(interval) === 
                                            intervalsToShow.filter(i => i.journeyIndex === interval.journeyIndex).length - 1
              const isAtEndOfInterval = progress >= 95 // Cerca del final del intervalo (95% o más)
              
              // Verificar si el trayecto está completo (no es incompleto)
              // Buscar en los journeys si este trayecto está marcado como incompleto
              const journey = csvResults?.data?.journeys?.find((j: any) => 
                j.journeyIndex === interval.journeyIndex
              )
              const isJourneyComplete = !journey?.metadata?.isIncomplete
              
              // Un trayecto termina SOLO si es el último intervalo, estamos cerca del final Y el trayecto está completo
              const isJourneyEnding = isLastIntervalOfJourney && isAtEndOfInterval && isJourneyComplete
              
              // Calcular velocidad interpolada del punto específico
              let pointSpeed = 'N/A'
              if (totalPoints > 1) {
                const currentPoint = interval.coordinatePoints[closestPointIndex]
                const nextPoint = interval.coordinatePoints[Math.min(closestPointIndex + 1, totalPoints - 1)]
                
                // Si el punto actual tiene velocidad, usarla; sino interpolar
                if (currentPoint && currentPoint.speed !== null && currentPoint.speed !== undefined) {
                  pointSpeed = `${currentPoint.speed.toFixed(1)} kn`
                } else if (nextPoint && nextPoint.speed !== null && nextPoint.speed !== undefined) {
                  // Interpolar entre puntos si es necesario
                  const factor = progress / 100
                  const interpolatedSpeed = currentPoint?.speed || nextPoint.speed
                  pointSpeed = `${interpolatedSpeed.toFixed(1)} kn`
                } else {
                  // Usar velocidad promedio del intervalo como fallback
                  pointSpeed = interval.avgSpeed ? `${interval.avgSpeed.toFixed(1)} kn` : 'N/A'
                }
              }
              
              // Interpolar datos del punto específico basado en el progreso
                const startTime = interval.startTime ? new Date(interval.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'h' : 'N/A'
                const endTime = interval.endTime ? new Date(interval.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'h' : 'N/A'
                const date = interval.startTime ? new Date(interval.startTime).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A'
              
              // Calcular tiempo estimado del punto específico
              const startTimestamp = interval.startTime ? new Date(interval.startTime).getTime() : 0
              const endTimestamp = interval.endTime ? new Date(interval.endTime).getTime() : 0
              const pointTimestamp = startTimestamp + (endTimestamp - startTimestamp) * (progress / 100)
              const pointTime = new Date(pointTimestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'h'
              
              // Si estamos en el final de un trayecto, mostrar mensaje especial
              if (isJourneyEnding) {
                return `
                  <div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000000; background-color: #FFFFFF; padding: 10px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 220px;">
                    <!-- Mensaje de final de trayecto -->
                    <div style="color: #DC2626; font-weight: 600; font-size: 12px; margin-bottom: 4px; text-align: center; background-color: #FEE2E2; padding: 6px; border-radius: 4px;">
                      FINAL DE TRAYECTO ${journeyIndex}
                    </div>
                    <div style="color: #9CA3AF; font-size: 11px; margin-bottom: 3px;">
                      <span style="color: #374151; font-weight: 500;">Tiempo:</span> ${pointTime} - ${date}
                    </div>
                    <div style="color: #9CA3AF; font-size: 11px; margin-bottom: 3px;">
                      <span style="color: #374151; font-weight: 500;">Velocidad:</span> <span style="color: #3B82F6; font-weight: bold;">${pointSpeed}</span>
                    </div>
                  </div>
                `
              }

              return `
                <div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000000; background-color: #FFFFFF; padding: 10px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 220px;">
                  <!-- Datos del punto específico (arriba) -->
                  <div style="border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; margin-bottom: 8px;">
                     <div style="color: #374151; font-weight: 600; font-size: 12px; margin-bottom: 4px;">POSICIÓN (${pointLatLng.lat.toFixed(6)}, ${pointLatLng.lng.toFixed(6)})</div>
                    <div style="color: #9CA3AF; font-size: 11px; margin-bottom: 3px;">
                      <span style="color: #374151; font-weight: 500;">Tiempo:</span> ${pointTime} - ${date}
                    </div>
                    <div style="color: #9CA3AF; font-size: 11px; margin-bottom: 3px;">
                      <span style="color: #374151; font-weight: 500;">Velocidad:</span> <span style="color: #3B82F6; font-weight: bold;">${pointSpeed}</span>
                    </div>
                    </div>
                    
                  <!-- Datos del intervalo completo (abajo) -->
                  <div style="font-size: 11px; color: #9CA3AF;">
                     <div style="color: #374151; font-weight: 600; font-size: 12px; margin-bottom: 4px;">INTERVALO ${interval.intervalNumber} - TRAYECTO ${journeyIndex}</div>
                    <div style="margin-bottom: 3px;">
                      <span style="color: #374151; font-weight: 500;">Velocidad Media:</span> 
                      <span style="color: #3B82F6; font-weight: bold;">${interval.avgSpeed?.toFixed(1) || 'N/A'} kn</span>
                      <span style="color: #374151; font-weight: 500; margin-left: 8px;">Estado:</span>
                      <span style="color: #10B981; font-weight: bold;">${interval.navStatus}</span>
                      </div>
                    <div style="margin-bottom: 3px;">
                      <span style="color: #374151; font-weight: 500;">Progreso:</span> ${progress.toFixed(0)}%
                      </div>
                    <div style="margin-bottom: 3px;">
                      <span style="color: #374151; font-weight: 500;">Actividad:</span> ${interval.classificationType || 'N/A'}
                      </div>
                    <div style="color: #9CA3AF; font-size: 11px; margin-bottom: 3px;">
                      <span style="color: #374151; font-weight: 500;">Duración:</span> ${formatDuration(interval.duration)} (${startTime} → ${endTime})
                    </div>
                  </div>
                </div>
              `
            }

            // Función para calcular el punto más cercano en la línea con interpolación suave
            const getClosestPointOnLine = (mouseLatLng: any, lineCoordinates: [number, number][]) => {
              let minDistance = Infinity
              let closestSegmentIndex = 0
              let closestPoint = lineCoordinates[0]
              let closestDistance = Infinity

              // Buscar el segmento más cercano en la línea
              for (let i = 0; i < lineCoordinates.length - 1; i++) {
                const p1 = lineCoordinates[i]
                const p2 = lineCoordinates[i + 1]
                
                // Calcular distancia perpendicular del punto al segmento
                const segmentLength = mapInstanceRef.current.distance(p1, p2)
                if (segmentLength === 0) continue
                
                // Proyección del punto sobre el segmento
                const t = Math.max(0, Math.min(1, 
                  ((mouseLatLng.lat - p1[0]) * (p2[0] - p1[0]) + (mouseLatLng.lng - p1[1]) * (p2[1] - p1[1])) / 
                  ((p2[0] - p1[0]) * (p2[0] - p1[0]) + (p2[1] - p1[1]) * (p2[1] - p1[1]))
                ))
                
                const projectedPoint: [number, number] = [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])]
                const distance = mapInstanceRef.current.distance(mouseLatLng, projectedPoint)
                
                if (distance < minDistance) {
                  minDistance = distance
                  closestSegmentIndex = i
                  closestPoint = projectedPoint
                  closestDistance = distance
                }
              }
              
              return { point: closestPoint, distance: closestDistance, segmentIndex: closestSegmentIndex }
            }

            // Función para manejar el movimiento del mouse en el mapa (estilo MyShipTracking)
            const handleMapMouseMove = (e: any) => {
              if (!proximityActiveRef.current || !currentPolylineRef.current) return

              const { point, distance } = getClosestPointOnLine(e.latlng, intervalCoordinates)
              
              // Si el cursor está cerca de la línea (dentro de 150 metros)
              if (distance < 150) {
                // Generar contenido dinámico para la posición del cursor
                const dynamicContent = generateTooltipContent(point, interval)
                
                if (!tooltipRef.current) {
                  // Crear tooltip de proximidad
                  tooltipRef.current = L.tooltip({
                    content: dynamicContent,
                    permanent: false,
                    direction: 'top',
                    offset: [0, -10],
                    opacity: 0.95,
                    className: 'custom-tooltip proximity-tooltip'
                  })
                } else {
                  tooltipRef.current.setContent(dynamicContent)
                }
                
                // Posicionar el tooltip en el punto más cercano de la línea
                tooltipRef.current.setLatLng(point)
                tooltipRef.current.openOn(mapInstanceRef.current)
              } else {
                // Si está lejos, cerrar el tooltip
                if (tooltipRef.current) {
                  mapInstanceRef.current.closeTooltip(tooltipRef.current)
                  tooltipRef.current = null
                }
              }
            }

            // Agregar eventos específicos de la línea
            polyline.on('mouseover', function(e: any) {
              // Activar el modo de proximidad
              proximityActiveRef.current = true
              currentPolylineRef.current = polyline
              
              // Generar contenido dinámico para la posición del cursor
              const dynamicContent = generateTooltipContent(e.latlng, interval)
              
              // Mostrar tooltip inmediatamente
              if (!tooltipRef.current) {
                tooltipRef.current = L.tooltip({
                  content: dynamicContent,
                  permanent: false,
                  direction: 'top',
                  offset: [0, -10],
                  opacity: 0.95,
                  className: 'custom-tooltip proximity-tooltip'
                })
              } else {
                tooltipRef.current.setContent(dynamicContent)
              }
              
              tooltipRef.current.setLatLng(e.latlng)
              tooltipRef.current.openOn(mapInstanceRef.current)
            })

            polyline.on('mouseout', function(e: any) {
              // No desactivar inmediatamente, dejar que el evento global maneje la proximidad
              // Esto permite que el tooltip siga funcionando mientras el cursor esté cerca
            })


            // Guardar la función generadora y datos del intervalo en la polyline
            polyline.generateTooltipContent = generateTooltipContent
            polyline.intervalData = interval

                polyline.addTo(mapInstanceRef.current)
                polylinesRef.current.push(polyline)
          }
        }
      })

      // Ajustar vista del mapa para mostrar todos los trayectos
      if (intervalsToShow.length > 0 && polylinesRef.current.length > 0) {
        const group = new L.featureGroup(polylinesRef.current)
          mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1))
      }
    } catch (error) {
      console.warn('Error al mostrar trayectos en el mapa:', error)
      // Continuar sin mostrar el mapa si hay error
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
      
      // Agregar evento global de movimiento del mouse al mapa
      const handleGlobalMouseMove = (e: any) => {
        if (!proximityActiveRef.current) return

        // Buscar todas las polylines activas
        let closestDistance = Infinity
        let closestPoint = null
        let closestPolyline = null

        polylinesRef.current.forEach((polyline: any) => {
          const latlngs = polyline.getLatLngs()
          if (latlngs && latlngs.length > 0) {
            for (let i = 0; i < latlngs.length; i++) {
              const distance = mapInstanceRef.current.distance(e.latlng, latlngs[i])
              if (distance < closestDistance) {
                closestDistance = distance
                closestPoint = latlngs[i]
                closestPolyline = polyline
              }
            }
          }
        })

        // Si el cursor está cerca de alguna línea (dentro de 500 metros - hitbox más grande)
        if (closestDistance < 500 && closestPoint && closestPolyline) {
          // Generar contenido dinámico basado en la posición del cursor
          const dynamicContent = (closestPolyline as any).generateTooltipContent 
            ? (closestPolyline as any).generateTooltipContent(closestPoint, (closestPolyline as any).intervalData)
            : 'Información del trayecto'
          
          if (!tooltipRef.current) {
            // Crear tooltip de proximidad con contenido dinámico
            const L = window.L
            tooltipRef.current = L.tooltip({
              content: dynamicContent,
              permanent: false,
              direction: 'top',
              offset: [0, -10],
              opacity: 0.95,
              className: 'custom-tooltip proximity-tooltip'
            })
          } else {
            // Actualizar contenido del tooltip existente
            tooltipRef.current.setContent(dynamicContent)
          }
          
          // Posicionar el tooltip en el punto más cercano de la línea con interpolación suave
          tooltipRef.current.setLatLng(closestPoint)
          tooltipRef.current.openOn(mapInstanceRef.current)
        } else {
          // Si está muy lejos (más de 800 metros), desactivar modo de proximidad
          if (closestDistance > 800) {
            proximityActiveRef.current = false
            currentPolylineRef.current = null
            
            if (tooltipRef.current) {
              mapInstanceRef.current.closeTooltip(tooltipRef.current)
              tooltipRef.current = null
            }
          }
        }
      }

      mapInstanceRef.current.on('mousemove', handleGlobalMouseMove)
    } else if (mapInstanceRef.current && selectedJourneys.size === 0) {
      clearMap()
    }
  }, [selectedJourneys, csvResults])

  return (
    <div className="w-full h-full bg-white relative">
      <div 
        ref={mapRef} 
        className="w-full h-full bg-white"
        style={{
          /* Asegurar que el mapa esté en el fondo */
          zIndex: 1
        }}
      />
      <style>{`
        /* Estilos específicos para tooltips personalizados de Leaflet */
        .custom-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        
        .custom-tooltip .leaflet-tooltip-content {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Estilos para marcadores personalizados */
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
        
        /* Mejorar la apariencia de los popups de Leaflet */
        .leaflet-popup-content {
          font-family: Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif !important;
          font-size: 14px !important;
          line-height: 1.4 !important;
        }
        
        .leaflet-popup-content-wrapper {
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }
        
        /* Estilos específicos del mapa de Leaflet */
        .leaflet-container {
          background-color: white !important;
          z-index: 1 !important;
        }
        
        .leaflet-control-container {
          z-index: 1000 !important;
        }
        
        /* Asegurar que los popups de Leaflet tengan prioridad correcta */
        .leaflet-popup {
          z-index: 2000 !important;
        }
        
        .leaflet-popup-pane {
          z-index: 2000 !important;
        }
        
        /* Ocultar completamente la atribución de Leaflet */
        .leaflet-control-attribution {
          display: none !important;
        }
        
        .leaflet-control-container .leaflet-control-attribution {
          display: none !important;
        }
        
        /* Estilos para flechas direccionales si se necesitan */
        .directional-arrow {
          background: transparent !important;
          border: none !important;
          z-index: 1000 !important;
        }
        
        .directional-arrow div {
          transition: transform 0.2s ease;
        }
        
        .leaflet-marker-icon.directional-arrow {
          z-index: 1000 !important;
        }
      `}</style>
    </div>
  )
})

MapViewer.displayName = 'MapViewer'

export default MapViewer