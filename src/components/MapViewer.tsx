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
  
  // Refs para optimización de rendimiento
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastMousePositionRef = useRef<any>(null)
  const mouseMoveCounterRef = useRef<number>(0)

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

  // Función de debounce para optimizar actualizaciones
  const debounce = (func: () => void, delay: number) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(func, delay)
  }
  
  // Funciones para análisis geométrico de intervalos
  const calculateRouteLength = (coordinates: [number, number][]): number => {
    let totalLength = 0
    for (let i = 1; i < coordinates.length; i++) {
      const [lat1, lon1] = coordinates[i - 1]
      const [lat2, lon2] = coordinates[i]
      // Distancia aproximada en grados (para comparación relativa)
      const distance = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2))
      totalLength += distance
    }
    return totalLength
  }

  const calculateCurvatureComplexity = (coordinates: [number, number][]): number => {
    if (coordinates.length < 3) return 0
    
    let totalCurvature = 0
    let maxCurvature = 0
    
    for (let i = 1; i < coordinates.length - 1; i++) {
      const prev = coordinates[i - 1]
      const curr = coordinates[i]
      const next = coordinates[i + 1]
      
      // Calcular cambio de dirección
      const angle1 = Math.atan2(curr[1] - prev[1], curr[0] - prev[0])
      const angle2 = Math.atan2(next[1] - curr[1], next[0] - curr[0])
      let angleDiff = Math.abs(angle1 - angle2)
      
      // Normalizar diferencia de ángulo
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff
      
      totalCurvature += angleDiff
      maxCurvature = Math.max(maxCurvature, angleDiff)
    }
    
    // Retornar complejidad combinada (curvatura total + máxima)
    return totalCurvature * 0.7 + maxCurvature * 0.3
  }

  // Función adaptativa para determinar densidad óptima de puntos por intervalo
  const getOptimalPointDensity = (coordinates: [number, number][], interval: any): [number, number][] => {
    const routeLength = calculateRouteLength(coordinates)
    const curvature = calculateCurvatureComplexity(coordinates)
    const originalPointCount = coordinates.length
    
    // Si la ruta es muy corta o tiene pocos puntos, no simplificar
    if (originalPointCount <= 15 || routeLength < 0.005) {
      return coordinates
    }
    
    // Calcular factores de complejidad
    const isLongRoute = routeLength > 0.05 // Ruta larga
    const isHighCurvature = curvature > 1.0 // Ruta con muchas curvas
    const isMediumCurvature = curvature > 0.3 // Ruta con curvas moderadas
    
    // Determinar estrategia de simplificación según características de la ruta
    let targetReduction = 0
    let tolerance = 0.0001
    
    if (isHighCurvature) {
      // Rutas muy curvas: mantener 80-90% de los puntos
      targetReduction = 0.1
      tolerance = 0.00005 // Tolerancia muy baja
    } else if (isMediumCurvature && isLongRoute) {
      // Rutas largas con curvas moderadas: mantener 60-70% de los puntos
      targetReduction = 0.35
      tolerance = 0.0001
    } else if (isLongRoute && !isMediumCurvature) {
      // Rutas largas y bastante rectas: mantener 40-50% de los puntos
      targetReduction = 0.55
      tolerance = 0.0002
    } else {
      // Rutas cortas con poca curvatura: mantener 70% de los puntos
      targetReduction = 0.3
      tolerance = 0.0001
    }
    
    // Aplicar simplificación adaptativa
    return adaptiveSimplifyCoordinates(coordinates, tolerance, targetReduction)
  }

  // Función de simplificación adaptativa que respeta la geometría marítima
  const adaptiveSimplifyCoordinates = (
    coordinates: [number, number][],
    tolerance: number,
    targetReduction: number
  ): [number, number][] => {
    if (coordinates.length <= 3) return coordinates
    
    const simplified: [number, number][] = [coordinates[0]] // Siempre mantener el primer punto
    
    for (let i = 1; i < coordinates.length - 1; i++) {
      const prev = coordinates[i - 1]
      const curr = coordinates[i]
      const next = coordinates[i + 1]
      
      // Calcular cambio de dirección
      const angle1 = Math.atan2(curr[1] - prev[1], curr[0] - prev[0])
      const angle2 = Math.atan2(next[1] - curr[1], next[0] - curr[0])
      let angleDiff = Math.abs(angle1 - angle2)
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff
      
      // Calcular distancia desde el último punto añadido
      const lastAdded = simplified[simplified.length - 1]
      const distanceFromLast = Math.sqrt(
        Math.pow(curr[0] - lastAdded[0], 2) + Math.pow(curr[1] - lastAdded[1], 2)
      )
      
      // Criterios para mantener el punto (más estrictos para navegación marítima)
      const hasSignificantDirectionChange = angleDiff > 0.05 // Cambio de dirección > 3 grados
      const isDistantFromLast = distanceFromLast > tolerance * 8
      const isSignificantCurve = angleDiff > 0.15 // Curva importante > 8.6 grados
      
      // Siempre mantener puntos con cambios importantes de dirección o curvas significativas
      if (hasSignificantDirectionChange || isDistantFromLast || isSignificantCurve) {
        simplified.push(curr)
      }
    }
    
    simplified.push(coordinates[coordinates.length - 1]) // Siempre mantener el último punto
    
    // Si aún tenemos demasiados puntos, aplicar reducción adicional pero conservadora
    const currentReduction = 1 - (simplified.length / coordinates.length)
    if (currentReduction < targetReduction && simplified.length > 20) {
      return applyAdditionalReduction(simplified, targetReduction - currentReduction)
    }
    
    return simplified
  }

  // Reducción adicional muy conservadora cuando es necesario
  const applyAdditionalReduction = (coordinates: [number, number][], additionalReduction: number): [number, number][] => {
    const step = Math.max(2, Math.floor(1 / additionalReduction))
    const result: [number, number][] = [coordinates[0]]
    
    for (let i = step; i < coordinates.length - 1; i += step) {
      result.push(coordinates[i])
    }
    
    result.push(coordinates[coordinates.length - 1])
    return result
  }

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
    
    // Limpiar timer de debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
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
      
      // Optimización: Solo simplificar en casos extremos (>200 intervalos)
      const shouldSimplify = intervalsToShow.length > 200


      // Detectar el último intervalo de cada trayecto antes de dibujar
      const lastIntervalsByJourney: Map<number, any> = new Map()
      
      intervalsToShow.forEach((interval: any) => {
        const journeyIndex = interval.journeyIndex
        const intervalsOfThisJourney = intervalsToShow.filter(i => i.journeyIndex === journeyIndex)
        const currentIntervalIndex = intervalsOfThisJourney.indexOf(interval)
        const isLastIntervalOfJourney = currentIntervalIndex === intervalsOfThisJourney.length - 1
        
        if (isLastIntervalOfJourney) {
          const journey = csvResults?.data?.journeys?.find((j: any) => j.journeyIndex === journeyIndex)
          const isJourneyComplete = !journey?.metadata?.isIncomplete
          
          if (isJourneyComplete) {
            lastIntervalsByJourney.set(journeyIndex, interval)
          }
        }
      })

      // Dibujar cada intervalo (mantener precisión de rutas)
      intervalsToShow.forEach((interval: any, idx: number) => {
        const journeyIndex = interval.journeyIndex
        const intervalColor = getJourneyColor(journeyIndex)
        
        // Optimización: reducir marcadores solo en casos extremos (>100 intervalos)
        const shouldReduceMarkers = intervalsToShow.length > 100

          // Crear polyline para este intervalo
          if (interval.coordinatePoints && interval.coordinatePoints.length > 1) {
            const intervalCoordinates: [number, number][] = []
            
            interval.coordinatePoints.forEach((point: any) => {
              if (point.lat && point.lon && !isNaN(point.lat) && !isNaN(point.lon)) {
                intervalCoordinates.push([point.lat, point.lon])
              }
            })
            
            // Aplicar optimización adaptativa basada en longitud y curvatura del intervalo
            let coordinatesToUse = intervalCoordinates
            let routeAnalysis = { length: 0, curvature: 0 }
            
            if (shouldSimplify && intervalCoordinates.length > 20) {
              // Calcular características de la ruta antes de simplificar
              routeAnalysis.length = calculateRouteLength(intervalCoordinates)
              routeAnalysis.curvature = calculateCurvatureComplexity(intervalCoordinates)
              coordinatesToUse = getOptimalPointDensity(intervalCoordinates, interval)
            }

            if (coordinatesToUse.length > 1) {
                // Determinar smoothFactor adaptativo basado en las características de la ruta
                let adaptiveSmoothFactor = 1
                if (shouldSimplify) {
                  if (routeAnalysis.curvature > 1.0) {
                    adaptiveSmoothFactor = 0.5 // Muy poco suavizado para rutas curvas
                  } else if (routeAnalysis.curvature > 0.3) {
                    adaptiveSmoothFactor = 1 // Suavizado normal para rutas moderadas
                  } else {
                    adaptiveSmoothFactor = 2 // Más suavizado para rutas rectas
                  }
                }
                
                const polyline = L.polyline(coordinatesToUse, {
                  color: intervalColor,
                  weight: shouldReduceMarkers ? 2 : 3, // Líneas más finas cuando hay muchos trayectos
                  opacity: shouldReduceMarkers ? 0.7 : 0.8, // Ligeramente menos opacas
                  smoothFactor: adaptiveSmoothFactor // Suavizado adaptativo según curvatura
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

                // Agregar marcadores de inicio y fin del intervalo (optimizado)
                const startPoint = coordinatesToUse[0]
                const endPoint = coordinatesToUse[coordinatesToUse.length - 1]
                
                // Solo agregar marcadores si no hay demasiados intervalos o si es importante
                if (!shouldReduceMarkers || idx % 3 === 0) { // Mostrar 1 de cada 3 cuando hay muchos
                  // Marcador de inicio (color del trayecto - completo)
                  const startMarker = L.circleMarker(startPoint, {
                    radius: shouldReduceMarkers ? 4 : 6, // Marcadores más pequeños cuando hay muchos
                    fillColor: intervalColor,
                    color: '#FFFFFF',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                  }).addTo(mapInstanceRef.current)
                  
                  // Marcador de fin (color del trayecto - completo)  
                  const endMarker = L.circleMarker(endPoint, {
                    radius: shouldReduceMarkers ? 4 : 6, // Marcadores más pequeños cuando hay muchos
                    fillColor: intervalColor,
                    color: '#FFFFFF',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                  }).addTo(mapInstanceRef.current)
                  
                  // Guardar marcadores para poder limpiarlos después
                  markersRef.current.push(startMarker, endMarker)
                }

            
            // Función para generar contenido del tooltip con datos del punto específico
            const generateTooltipContent = (pointLatLng: any, interval: any) => {
              // Calcular la posición relativa del punto en la trayectoria (0-100%)
              // Usar interval.coordinatePoints para el cálculo preciso (no simplificado)
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
              const intervalsOfThisJourney = intervalsToShow.filter(i => i.journeyIndex === interval.journeyIndex)
              const currentIntervalIndex = intervalsOfThisJourney.indexOf(interval)
              const isLastIntervalOfJourney = currentIntervalIndex === intervalsOfThisJourney.length - 1
              
              // Detectar si estamos en el último punto del último intervalo
              const isLastPoint = closestPointIndex >= totalPoints - 1
              const isAtEndOfInterval = isLastPoint || progress >= 98 // Cerca del final del intervalo o en el último punto

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
                  <div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000000; background-color: #FFFFFF; padding: 10px; border-radius: 6px; min-width: 220px;">
                    <!-- Mensaje de final de trayecto -->
                    <div style="color: #DC2626; font-weight: 600; font-size: 12px; margin-bottom: 4px; text-align: center; background-color: #FEE2E2; padding: 6px; border-radius: 4px;">
                      🏁 FINAL DE TRAYECTO ${journeyIndex}
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
                <div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000000; background-color: #FFFFFF; padding: 10px; border-radius: 6px; min-width: 220px;">
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
            const getClosestPointOnLine = (mouseLatLng: any) => {
              let minDistance = Infinity
              let closestSegmentIndex = 0
              let closestPoint = coordinatesToUse[0]
              let closestDistance = Infinity

              // Buscar el segmento más cercano en la línea
              for (let i = 0; i < coordinatesToUse.length - 1; i++) {
                const p1 = coordinatesToUse[i]
                const p2 = coordinatesToUse[i + 1]
                
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

              const { point, distance } = getClosestPointOnLine(e.latlng)
              
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

      // Agregar marcadores especiales "FINAL DE TRAYECTO" en el último punto de trayectos completos
      lastIntervalsByJourney.forEach((lastInterval, journeyIndex) => {
        if (lastInterval.coordinatePoints && lastInterval.coordinatePoints.length > 0) {
          const lastPoint = lastInterval.coordinatePoints[lastInterval.coordinatePoints.length - 1]
          
          if (lastPoint && lastPoint.lat && lastPoint.lon) {
            const intervalColor = getJourneyColor(journeyIndex)
            
                                                      // Crear marcador de final de trayecto con el mismo tamaño que los demás
              const finalMarker = L.circleMarker([lastPoint.lat, lastPoint.lon], {
                radius: 6,
                fillColor: intervalColor,
                color: '#FFFFFF',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
              })
            
            // Agregar eventos para controlar la visibilidad de otros tooltips
            finalMarker.on('mouseover', function() {
              // Cerrar todos los demás tooltips de polylines
              polylinesRef.current.forEach((polyline: any) => {
                if (polyline._tooltip && mapInstanceRef.current) {
                  mapInstanceRef.current.closeTooltip(polyline._tooltip)
                  polyline._tooltip = null
                }
              })
              // Cerrar el tooltip de proximidad global y desactivar el modo de proximidad
              if (tooltipRef.current && mapInstanceRef.current) {
                mapInstanceRef.current.closeTooltip(tooltipRef.current)
                tooltipRef.current = null
              }
              proximityActiveRef.current = false
              currentPolylineRef.current = null
            })
            
            // Preparar información para el tooltip
            const finalTime = lastInterval.endTime ? new Date(lastInterval.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'h' : 'N/A'
            const finalDate = lastInterval.endTime ? new Date(lastInterval.endTime).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A'
            
            finalMarker.bindTooltip(`
              <div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #000000; background-color: #FFFFFF; padding: 10px; border-radius: 6px; min-width: 180px;">
                <div style="color: #DC2626; font-weight: 600; font-size: 13px; margin-bottom: 4px; text-align: center; background-color: #FEE2E2; padding: 6px; border-radius: 4px;">
                  FINAL DE TRAYECTO ${journeyIndex}
                </div>
                <div style="color: #9CA3AF; font-size: 11px; margin-top: 6px;">
                  <span style="color: #374151; font-weight: 500;">Hora Final:</span> 
                  ${finalTime} - ${finalDate}
                </div>
              </div>
            `, {
              permanent: false,
              direction: 'auto',
              offset: [0, -10],
              opacity: 0.95,
              className: 'custom-tooltip proximity-tooltip'
            }).addTo(mapInstanceRef.current)
            
            markersRef.current.push(finalMarker)
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
      
      // Agregar evento global de movimiento del mouse al mapa (con throttling)
      const handleGlobalMouseMove = (e: any) => {
        if (!proximityActiveRef.current) return

        // Throttling: procesar solo cada 5 eventos
        mouseMoveCounterRef.current++
        if (mouseMoveCounterRef.current % 5 !== 0) return

        // Buscar todas las polylines activas
        let closestDistance = Infinity
        let closestPoint = null
        let closestPolyline = null

        // Optimización: limitar búsqueda a polylines cercanas
        const maxSearchDistance = 500 // metros
        polylinesRef.current.forEach((polyline: any) => {
          const latlngs = polyline.getLatLngs()
          if (latlngs && latlngs.length > 0) {
            // Buscar solo en muestras de puntos (no todos los puntos)
            const sampleRate = Math.max(1, Math.floor(latlngs.length / 50))
            for (let i = 0; i < latlngs.length; i += sampleRate) {
              const distance = mapInstanceRef.current.distance(e.latlng, latlngs[i])
              if (distance < closestDistance && distance < maxSearchDistance) {
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