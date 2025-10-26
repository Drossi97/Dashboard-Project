import { useState } from "react"
import { useCSVConverter, type RawDataRow } from "./useCSVConverter"

// Puerto coordinates
const PORTS = [
  { name: "Algeciras", lat: 36.128740148, lon: -5.439981128 },
  { name: "Tanger Med", lat: 35.880312709, lon: -5.515627045 },
  { name: "Ceuta", lat: 35.889, lon: -5.307 },
  { name: "Gibraltar", lat: 36.147611, lon: -5.365393 }
]

export interface PortDistances {
  Algeciras: number
  "Tanger Med": number
  Ceuta: number
  Gibraltar: number
}

export interface PortAnalysisWithMin {
  Algeciras: number
  "Tanger Med": number
  Ceuta: number
  Gibraltar: number
  nearestPort: string
  nearestDistance: number
}

export interface CoordinatePoint {
  lat: number | null
  lon: number | null
  timestamp: string
  speed: number | null
  navStatus: string
}

export interface SimpleInterval {
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
  startPortDistances: PortAnalysisWithMin
  endPortDistances: PortAnalysisWithMin
  classificationType: string
  journeyIndex: number
  intervalNumber: number
  coordinatePoints: CoordinatePoint[]
}

export interface GapInterval {
  startTime: string
  endTime: string
  duration: string
  reason: string
  beforeJourneyIndex: number
  afterJourneyIndex: number
}

export interface Journey {
  journeyIndex: number
  intervals: SimpleInterval[]
  metadata: {
    startPort: string
    endPort: string
    startDate: string
    endDate: string
    startTime: string
    endTime: string
    totalDuration: string
    isIncomplete: boolean
    incompleteness: {
      start: boolean
      end: boolean
    }
    intervalCount: number
    classificationTypes: string[]
  }
}

export interface CSVIntervalResult {
  success: boolean
  data?: {
    journeys: Journey[]
    gaps: GapInterval[]
    summary: {
      totalIntervals: number
      totalRows: number
      filesProcessed: number
      totalJourneys: number
      incompleteJourneys: number
      totalGaps: number
    }
  }
  error?: string
  meta?: {
    totalRows: number
    filesProcessed: number
    processedFiles: Array<{ file: string; rows: number }>
    errors: string[]
  }
}

// Constantes matemáticas
const EARTH_RADIUS_KM = 6371
const DEG_TO_RAD = Math.PI / 180

// Constantes de tiempo
const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 1000 * 60
const MS_PER_HOUR = 1000 * 60 * 60

// Constantes para análisis de gaps
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86400

// Constantes de distancias
const PORT_ZONE_DISTANCE_KM = 5 // Aumentado de 3 a 5 km para detección más robusta
const MAX_ANALYSIS_DISTANCE_KM = 30

// Cache para distancias
const distanceCache = new Map<string, PortAnalysisWithMin>()
const MAX_CACHE_SIZE = 10000

const clearDistanceCache = () => {
  distanceCache.clear()
}

// Funciones helper
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const dLat = (lat2 - lat1) * DEG_TO_RAD
  const dLon = (lon2 - lon1) * DEG_TO_RAD
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return EARTH_RADIUS_KM * c
}

const calculateAllPortDistances = (lat: number, lon: number): PortAnalysisWithMin => {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`
  
  if (distanceCache.has(cacheKey)) {
    return distanceCache.get(cacheKey)!
  }
  
  const distances = {
    Algeciras: calculateDistance(lat, lon, PORTS[0].lat, PORTS[0].lon),
    "Tanger Med": calculateDistance(lat, lon, PORTS[1].lat, PORTS[1].lon),
    Ceuta: calculateDistance(lat, lon, PORTS[2].lat, PORTS[2].lon),
    Gibraltar: calculateDistance(lat, lon, PORTS[3].lat, PORTS[3].lon)
  }
  
  const entries = Object.entries(distances) as [string, number][]
  const [nearestPort, nearestDistance] = entries.reduce((min, current) => 
    current[1] < min[1] ? current : min
  )
  
  const result = {
    ...distances,
    nearestPort,
    nearestDistance
  }
  
  if (distanceCache.size >= MAX_CACHE_SIZE) {
    const firstKey = distanceCache.keys().next().value
    if (firstKey) {
      distanceCache.delete(firstKey)
    }
  }
  
  distanceCache.set(cacheKey, result)
  return result
}

const calculateTimeDifference = (startTime: string, endTime: string): string => {
  try {
    const start = new Date(startTime)
    const end = new Date(endTime)
    const diffMs = end.getTime() - start.getTime()
    
    const days = Math.floor(diffMs / (24 * MS_PER_HOUR))
    const hours = Math.floor((diffMs % (24 * MS_PER_HOUR)) / MS_PER_HOUR)
    const minutes = Math.floor((diffMs % MS_PER_HOUR) / MS_PER_MINUTE)
    const seconds = Math.floor((diffMs % MS_PER_MINUTE) / MS_PER_SECOND)
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`
    } else {
      return `${hours}h ${minutes}m ${seconds}s`
    }
  } catch {
    return "0h 0m 0s"
  }
}

const calculateAverageSpeed = (points: Array<{speed: number | null}>): number | null => {
  const validSpeeds = points
    .map(p => p.speed)
    .filter(speed => speed !== null && speed !== undefined && !isNaN(speed)) as number[]
  
  if (validSpeeds.length === 0) return null
  
  return validSpeeds.reduce((sum, speed) => sum + speed, 0) / validSpeeds.length
}

const classifyIntervalType = (
  navStatus: string, 
  startPortDistances: PortAnalysisWithMin, 
  endPortDistances: PortAnalysisWithMin,
  intervalIndex: number,
  totalIntervals: number,
  startPort: string,
  endPort: string,
  isFirstWithNavStatus1: boolean
): string => {
  // Regla 1: Atracado en Puerto A (navStatus = 0.0, ≤ 5km puerto A)
  if (navStatus === "0.0" && intervalIndex === 0) {
    const isInPortA = startPortDistances.nearestDistance <= PORT_ZONE_DISTANCE_KM ||
                       endPortDistances.nearestDistance <= PORT_ZONE_DISTANCE_KM
    if (isInPortA) {
      return `Atracado en ${startPort}`
    }
    return "Parada" // Si está en 0.0 pero no en puerto (trayecto incompleto)
  }

  // Regla 2: Maniobrando en Puerto A (navStatus = 1.0, primer cambio desde 0.0)
  if (navStatus === "1.0" && isFirstWithNavStatus1) {
    const isInPortA = startPortDistances.nearestDistance <= PORT_ZONE_DISTANCE_KM ||
                       endPortDistances.nearestDistance <= PORT_ZONE_DISTANCE_KM
    if (isInPortA) {
      return `Maniobrando en ${startPort}`
    }
    return "Navegando en velocidad de maniobra hacia Puerto B"
  }

  // Regla 3: Maniobrando en Puerto B (navStatus = 1.0, pre-atraque)
  if (navStatus === "1.0" && intervalIndex === totalIntervals - 2) {
    // Verificar que el siguiente intervalo es el último y tiene navStatus 0.0
    const isInPortB = startPortDistances.nearestDistance <= PORT_ZONE_DISTANCE_KM ||
                       endPortDistances.nearestDistance <= PORT_ZONE_DISTANCE_KM
    if (isInPortB) {
      return `Maniobrando en ${endPort}`
    }
    return "Navegando en velocidad de maniobra hacia Puerto B"
  }

  // Regla 4: Navegando en velocidad de maniobra (navStatus = 1.0, otros casos)
  if (navStatus === "1.0") {
    return `Navegando en velocidad de maniobra hacia ${endPort}`
  }

  // Regla 5: Navegando hacia Puerto B (navStatus = 2.0)
  if (navStatus === "2.0") {
    return `Navegando hacia ${endPort}`
  }

  // Regla 6: Parada (navStatus = 0.0, no en puerto)
  if (navStatus === "0.0") {
    return "Parada"
  }

  return "Desconocido"
}

const createSimpleInterval = (
  points: Array<{latitude: number | null, longitude: number | null, speed: number | null, timestamp: string, navStatus: string}>, 
  startTime: string, 
  startDate: string, 
  intervalNumber: number,
  journeyIndex: number,
  intervalIndex: number,
  totalIntervals: number,
  startPort: string,
  endPort: string,
  isFirstWithNavStatus1: boolean
): SimpleInterval | null => {
  if (points.length === 0) return null

  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]

  // Calcular distancias a todos los puertos desde el punto inicial
  const startPortDistances = calculateAllPortDistances(firstPoint.latitude!, firstPoint.longitude!)
  
  // Calcular distancias a todos los puertos desde el punto final
  const endPortDistances = calculateAllPortDistances(lastPoint.latitude!, lastPoint.longitude!)

  // Clasificar el tipo de intervalo
  const classificationType = classifyIntervalType(
    firstPoint.navStatus, 
    startPortDistances, 
    endPortDistances,
    intervalIndex,
    totalIntervals,
    startPort,
    endPort,
    isFirstWithNavStatus1
  )

  // Crear array de puntos de coordenadas
  const coordinatePoints: CoordinatePoint[] = points.map(point => ({
    lat: point.latitude,
    lon: point.longitude,
    timestamp: point.timestamp,
    speed: point.speed,
    navStatus: point.navStatus
  }))

  // Extraer fecha y hora del último punto de forma segura
  let endDate = 'Fecha inválida'
  let endTime = 'Hora inválida'

  try {
    if (lastPoint.timestamp && typeof lastPoint.timestamp === 'string') {
      const parts = lastPoint.timestamp.split(' ')
      if (parts.length >= 2) {
        endDate = parts[0]
        endTime = lastPoint.timestamp
      } else {
        endDate = lastPoint.timestamp
        endTime = lastPoint.timestamp
      }
    }
  } catch (error) {
    // Continuar con valores por defecto si hay error al parsear fechas
  }

  const interval: SimpleInterval = {
    startDate: startDate,
    startTime: startTime,
    endDate: endDate,
    endTime: endTime,
    navStatus: firstPoint.navStatus,
    duration: calculateTimeDifference(startTime, lastPoint.timestamp),
    avgSpeed: calculateAverageSpeed(points),
    sampleCount: points.length,
    startLat: firstPoint.latitude,
    startLon: firstPoint.longitude,
    endLat: lastPoint.latitude,
    endLon: lastPoint.longitude,
    startPortDistances: startPortDistances,
    endPortDistances: endPortDistances,
    classificationType: classificationType,
    journeyIndex: journeyIndex,
    intervalNumber: intervalNumber,
    coordinatePoints: coordinatePoints
  }

  return interval
}

export function useCSVInterval() {
  const csvConverter = useCSVConverter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<CSVIntervalResult | null>(null)

  const processFiles = async (files: File[], delimiter: string = ",") => {
    if (files.length === 0) {
      setResults(null)
      return null
    }

    setIsProcessing(true)
    setResults(null)

    try {
      // Paso 1: Convertir CSV a JSON
      const csvResult = await csvConverter.processFiles(files, delimiter)
      
      if (!csvResult?.success || !('data' in csvResult) || !csvResult.data) {
        const errorResult = {
          success: false,
          error: csvResult?.error || "Error en la conversión de datos",
          meta: csvResult?.meta ? {
            totalRows: csvResult.meta.totalRows,
            filesProcessed: csvResult.meta.filesProcessed,
            processedFiles: csvResult.meta.processedFiles,
            errors: csvResult.meta.errors
          } : undefined
        }
        setResults(errorResult)
        return errorResult
      }

      // Paso 2: Procesar datos con algoritmo optimizado
      const rawData = csvResult.data
      
      if (!rawData || rawData.length === 0) {
        return {
          success: false,
          error: "No hay datos para procesar"
        }
      }

      // Algoritmo de detección de trayectos
      // Un trayecto comienza cuando navStatus = 0.0 en puerto A
      // y termina cuando navStatus = 0.0 en puerto B (diferente de A)
      
      interface JourneyBoundary {
        startIndex: number
        endIndex: number
        startPort: string
        endPort: string
        isComplete: boolean
      }
      
      const journeyBoundaries: JourneyBoundary[] = []
      let currentJourneyStart: number | null = null
      let currentStartPort: string | null = null
      
      // Detectar límites de trayectos
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i]
        
        // Validar coordenadas
        if (row.latitude === null || row.longitude === null || 
            isNaN(row.latitude) || isNaN(row.longitude)) {
          continue
        }
        
        // Calcular puerto más cercano
        const portDistances = calculateAllPortDistances(row.latitude, row.longitude)
        const isInPort = portDistances.nearestDistance <= PORT_ZONE_DISTANCE_KM
        const isAtracado = row.navStatus === "0.0"
        
        // Detectar inicio de trayecto: navStatus 0.0 en puerto
        if (isAtracado && isInPort && currentJourneyStart === null) {
          currentJourneyStart = i
          currentStartPort = portDistances.nearestPort.trim()
        }
        
        // Detectar fin de trayecto: navStatus 0.0 en puerto diferente
        if (isAtracado && isInPort && currentJourneyStart !== null && currentStartPort !== null) {
          const currentPort = portDistances.nearestPort.trim()

          // Solo termina si es un puerto diferente (comparación robusta)
          if (currentPort !== currentStartPort) {
            journeyBoundaries.push({
              startIndex: currentJourneyStart,
              endIndex: i,
              startPort: currentStartPort,
              endPort: currentPort,
              isComplete: true
            })

            // Preparar para el siguiente trayecto
            currentJourneyStart = i
            currentStartPort = currentPort
          }
        }
      }
      
      // Si hay un trayecto sin terminar, marcarlo como incompleto
      if (currentJourneyStart !== null && currentStartPort !== null) {
        journeyBoundaries.push({
          startIndex: currentJourneyStart,
          endIndex: rawData.length - 1,
          startPort: currentStartPort,
          endPort: "Desconocido",
          isComplete: false
        })
      }


      
      // Crear intervalos dentro de cada trayecto
      const journeys: Journey[] = []
      let totalIntervals = 0
      const gaps: GapInterval[] = []
      
      for (let journeyIndex = 0; journeyIndex < journeyBoundaries.length; journeyIndex++) {
        const boundary = journeyBoundaries[journeyIndex]
        const journeyData = rawData.slice(boundary.startIndex, boundary.endIndex + 1)
        
        // Saltar trayectos incompletos - no clasificar sus intervalos
        if (!boundary.isComplete) {
          journeys.push({
            journeyIndex: journeyIndex + 1,
            intervals: [], // Sin intervalos clasificados
            metadata: {
              startPort: boundary.startPort,
              endPort: boundary.endPort,
              startDate: rawData[boundary.startIndex]?.date || "",
              endDate: rawData[boundary.endIndex]?.date || "",
              startTime: rawData[boundary.startIndex]?.timestamp || "",
              endTime: rawData[boundary.endIndex]?.timestamp || "",
              totalDuration: calculateTimeDifference(
                rawData[boundary.startIndex]?.timestamp || "",
                rawData[boundary.endIndex]?.timestamp || ""
              ),
              isIncomplete: true,
              incompleteness: {
                start: false,
                end: true
              },
              intervalCount: 0,
              classificationTypes: []
            }
          })
          continue
        }
        
        // Crear intervalos basados en cambios de navStatus (solo trayectos completos)
        const intervals: SimpleInterval[] = []
        let currentIntervalStart = 0
        let currentNavStatus = journeyData[0]?.navStatus || "0.0"
        let intervalCounter = 0
        let foundFirstNavStatus1 = false
        
        // Primera pasada: contar intervalos
        let totalIntervalCount = 1
        for (let i = 1; i < journeyData.length; i++) {
          const row = journeyData[i]
          const newNavStatus = row.navStatus || "0.0"
          if (newNavStatus !== currentNavStatus) {
            totalIntervalCount++
            currentNavStatus = newNavStatus
          }
        }
        
        // Segunda pasada: crear intervalos
        currentNavStatus = journeyData[0]?.navStatus || "0.0"
        intervalCounter = 0
        
        for (let i = 1; i < journeyData.length; i++) {
          const row = journeyData[i]
          const newNavStatus = row.navStatus || "0.0"
          
          // Detectar cambio de navStatus
          if (newNavStatus !== currentNavStatus) {
            // Crear intervalo con los datos actuales
            intervalCounter++
            const intervalData = journeyData.slice(currentIntervalStart, i)
            
            if (intervalData.length > 0) {
              const isFirstNavStatus1 = currentNavStatus === "1.0" && !foundFirstNavStatus1
              if (isFirstNavStatus1) {
                foundFirstNavStatus1 = true
              }
              
              const interval = createSimpleInterval(
                intervalData,
                journeyData[currentIntervalStart].timestamp,
                journeyData[currentIntervalStart].date,
                intervalCounter,
                journeyIndex + 1,
                intervals.length,
                totalIntervalCount,
                boundary.startPort,
                boundary.endPort,
                isFirstNavStatus1
              )
              
            if (interval) {
              intervals.push(interval)
                totalIntervals++
              }
            }
            
            // Iniciar nuevo intervalo
            currentIntervalStart = i
            currentNavStatus = newNavStatus
          }
        }
        
        // Procesar el último intervalo
        if (currentIntervalStart < journeyData.length) {
          intervalCounter++
          const intervalData = journeyData.slice(currentIntervalStart)
          
          if (intervalData.length > 0) {
            const isFirstNavStatus1 = currentNavStatus === "1.0" && !foundFirstNavStatus1
            
            const interval = createSimpleInterval(
              intervalData,
              journeyData[currentIntervalStart].timestamp,
              journeyData[currentIntervalStart].date,
              intervalCounter,
              journeyIndex + 1,
              intervals.length,
              totalIntervalCount,
              boundary.startPort,
              boundary.endPort,
              isFirstNavStatus1
            )
            
        if (interval) {
          intervals.push(interval)
              totalIntervals++
            }
          }
        }
        
        // Crear journey con intervalos
        journeys.push({
          journeyIndex: journeyIndex + 1,
          intervals: intervals,
          metadata: {
            startPort: boundary.startPort,
            endPort: boundary.endPort,
            startDate: rawData[boundary.startIndex]?.date || "",
            endDate: rawData[boundary.endIndex]?.date || "",
            startTime: rawData[boundary.startIndex]?.timestamp || "",
            endTime: rawData[boundary.endIndex]?.timestamp || "",
            totalDuration: calculateTimeDifference(
              rawData[boundary.startIndex]?.timestamp || "",
              rawData[boundary.endIndex]?.timestamp || ""
            ),
            isIncomplete: !boundary.isComplete,
            incompleteness: {
              start: false,
              end: !boundary.isComplete
            },
            intervalCount: intervals.length,
            classificationTypes: [...new Set(intervals.map(i => i.classificationType))]
          }
        })
      }

      const finalResult: CSVIntervalResult = {
        success: true,
        data: {
          journeys: journeys,
          gaps: gaps,
          summary: {
            totalIntervals: totalIntervals,
            totalRows: rawData.length,
            filesProcessed: csvResult.meta?.filesProcessed || 0,
            totalJourneys: journeys.length,
            incompleteJourneys: journeys.filter(j => j.metadata.isIncomplete).length,
            totalGaps: gaps.length
          }
        },
        meta: csvResult.meta ? {
          totalRows: csvResult.meta.totalRows,
          filesProcessed: csvResult.meta.filesProcessed,
          processedFiles: csvResult.meta.processedFiles,
          errors: csvResult.meta.errors
        } : undefined
      }

      setResults(finalResult)
      return finalResult

    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        meta: {
          totalRows: 0,
          filesProcessed: 0,
          processedFiles: [],
          errors: [error instanceof Error ? error.message : "Error desconocido"]
        }
      }
      setResults(errorResult)
      return errorResult
    } finally {
      setIsProcessing(false)
    }
  }

  const clearResults = () => {
    csvConverter.clearResults()
    setResults(null)
    clearDistanceCache()
  }

  const isProcessingCombined = isProcessing || csvConverter.isProcessing

  return {
    results,
    isProcessing: isProcessingCombined,
    processFiles,
    clearResults,
    csvConverter
  }
}
