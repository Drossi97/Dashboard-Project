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

// Helper functions
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371 // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

const calculateAllPortDistances = (lat: number, lon: number): PortAnalysisWithMin => {
  const distances = {
    Algeciras: calculateDistance(lat, lon, PORTS[0].lat, PORTS[0].lon),
    "Tanger Med": calculateDistance(lat, lon, PORTS[1].lat, PORTS[1].lon),
    Ceuta: calculateDistance(lat, lon, PORTS[2].lat, PORTS[2].lon),
    Gibraltar: calculateDistance(lat, lon, PORTS[3].lat, PORTS[3].lon)
  }
  
  // Encontrar el puerto más cercano dinámicamente
  const entries = Object.entries(distances) as [string, number][]
  const [nearestPort, nearestDistance] = entries.reduce((min, current) => 
    current[1] < min[1] ? current : min
  )
  
  return {
    ...distances,
    nearestPort,
    nearestDistance
  }
}

const validateJourneyCompleteness = (intervals: SimpleInterval[]): {
  startsComplete: boolean
  endsComplete: boolean
  isIncomplete: boolean
} => {
  if (intervals.length === 0) {
    return { startsComplete: false, endsComplete: false, isIncomplete: true }
  }
  
  const firstInterval = intervals[0]
  const lastInterval = intervals[intervals.length - 1]
  
  const startsComplete = firstInterval.navStatus === "0.0" && 
                        firstInterval.startPortDistances.nearestDistance < 3
  
  const endsComplete = lastInterval.navStatus === "1.0" && 
                      lastInterval.endPortDistances.nearestDistance < 3 &&
                      lastInterval.endPortDistances.nearestPort !== firstInterval.startPortDistances.nearestPort
  
  return {
    startsComplete,
    endsComplete,
    isIncomplete: !startsComplete || !endsComplete
  }
}

const calculateTimeDifference = (startTime: string, endTime: string): string => {
  try {
    const start = new Date(startTime)
    const end = new Date(endTime)
    const diffMs = end.getTime() - start.getTime()
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
    
    return `${hours}h ${minutes}m ${seconds}s`
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

const classifyIntervalType = (navStatus: string, startPortDistances: PortAnalysisWithMin, endPortDistances: PortAnalysisWithMin): string => {
  // Verificar si está fuera de rango (distancia mínima > 30km)
  const minDistance = Math.min(
    startPortDistances.nearestDistance,
    endPortDistances.nearestDistance
  )
  if (minDistance > 30) {
    return "Fuera de rango"
  }

  // navStatus = 0.0
  if (navStatus === "0.0") {
    // Atracado en "nombre del puerto"
    // mismo puerto inicial y final, distancias <= 3 km
    if (startPortDistances.nearestPort === endPortDistances.nearestPort &&
        startPortDistances.nearestDistance <= 3 && 
        endPortDistances.nearestDistance <= 3) {
      return `Atracado en ${startPortDistances.nearestPort}`
    }
    
    // Parada
    // distancias > 3 km
    if (startPortDistances.nearestDistance > 3 || endPortDistances.nearestDistance > 3) {
      return "Parada"
    }
  }

  // navStatus = 1.0
  if (navStatus === "1.0") {
    // Maniobrando en "nombre del puerto"
    // mismo puerto inicial y final, distancias <= 3 km
    if (startPortDistances.nearestPort === endPortDistances.nearestPort &&
        startPortDistances.nearestDistance <= 3 && 
        endPortDistances.nearestDistance <= 3) {
      return `Maniobrando en ${startPortDistances.nearestPort}`
    }
    
    // Navegando cerca de "nombre del puerto"
    // mismo puerto inicial y final, distancias > 3 km
    if (startPortDistances.nearestPort === endPortDistances.nearestPort &&
        (startPortDistances.nearestDistance > 3 || endPortDistances.nearestDistance > 3)) {
      return `Navegando cerca de ${startPortDistances.nearestPort}`
    }
    
    // Navegando entre puertos diferentes
    // puertos inicial y final diferentes
    if (startPortDistances.nearestPort !== endPortDistances.nearestPort) {
      return `Navegando de ${startPortDistances.nearestPort} a ${endPortDistances.nearestPort}`
    }
  }

  // navStatus = 2.0
  if (navStatus === "2.0") {
    // Navegando de "nombre puerto inicial" a "nombre puerto destino"
    // puertos inicial y final diferentes
    if (startPortDistances.nearestPort !== endPortDistances.nearestPort) {
      return `Navegando de ${startPortDistances.nearestPort} a ${endPortDistances.nearestPort}`
    }
    
    // Navegando cerca de "nombre del puerto"
    // mismo puerto inicial y final
    if (startPortDistances.nearestPort === endPortDistances.nearestPort) {
      return `Navegando cerca de ${startPortDistances.nearestPort}`
    }
  }
  
  // Desconocido
  // Si no se cumple ninguna de las condiciones anteriores
  return "Desconocido"
}

const detectGap = (currentIntervalStartTime: string, previousIntervalEndTime: string, gapThresholdSeconds: number = 0.5): { hasGap: boolean, gapDuration?: string, gapReason?: string } => {
  try {
    const currentStart = new Date(currentIntervalStartTime)
    const previousEnd = new Date(previousIntervalEndTime)
    const gapMs = currentStart.getTime() - previousEnd.getTime()
    const gapSeconds = gapMs / 1000
    
    if (gapSeconds > gapThresholdSeconds) {
      // Calcular duración del gap
      const gapHours = Math.floor(gapSeconds / 3600)
      const gapMinutes = Math.floor((gapSeconds % 3600) / 60)
      const gapSecondsRemainder = Math.floor(gapSeconds % 60)
      
      let gapDuration = ""
      if (gapHours > 0) {
        gapDuration = `${gapHours}h ${gapMinutes}m ${gapSecondsRemainder}s`
      } else if (gapMinutes > 0) {
        gapDuration = `${gapMinutes}m ${gapSecondsRemainder}s`
      } else {
        gapDuration = `${gapSecondsRemainder}s`
      }
      
      // Determinar el tipo de gap
      let gapReason = "Gap de datos"
      if (gapSeconds > 86400) { // Más de 24 horas
        gapReason = "Gap prolongado (días)"
      } else if (gapSeconds > 3600) { // Más de 1 hora
        gapReason = "Gap de horas"
      } else if (gapSeconds > 60) { // Más de 1 minuto
        gapReason = "Gap de minutos"
      } else {
        gapReason = "Gap de segundos"
      }
      
      return {
        hasGap: true,
        gapDuration,
        gapReason
      }
    }
    
    return { hasGap: false }
  } catch (error) {
    return { hasGap: false }
  }
}

const assignJourneyIndexes = (intervals: SimpleInterval[]): { intervals: SimpleInterval[], gaps: GapInterval[], incompleteJourneys: Set<number> } => {
  if (intervals.length === 0) return { intervals, gaps: [], incompleteJourneys: new Set<number>() }
  
  let currentJourneyIndex = 1
  let lastIntervalEndTime = ""
  let journeyStartPort: string | null = null
  const gaps: GapInterval[] = []
  
  const updatedIntervals = intervals.map((interval, index) => {
    // Detectar gap temporal entre intervalos
    if (index > 0 && lastIntervalEndTime) {
      const gap = detectGap(interval.startTime, lastIntervalEndTime)
      if (gap.hasGap) {
        const previousJourneyIndex = currentJourneyIndex
        
        // Si hay un gap, incrementar el journeyIndex para crear un nuevo trayecto
        currentJourneyIndex++
        journeyStartPort = null // Reset del puerto de inicio
        
        // Registrar el gap
        gaps.push({
          startTime: lastIntervalEndTime,
          endTime: interval.startTime,
          duration: gap.gapDuration || '0s',
          reason: gap.gapReason || 'Gap de datos',
          beforeJourneyIndex: previousJourneyIndex,
          afterJourneyIndex: currentJourneyIndex
        })
      }
    }
    
    // Detectar cambio de estado que indica fin de trayecto
    if (index > 0) {
      const prevInterval = intervals[index - 1]
      
      // Lógica de fin de trayecto: cambio de 1.0 a 0.0
      // 1. El intervalo anterior debe estar navegando (1.0)
      // 2. El intervalo actual debe estar atracado (0.0)
      // 3. El intervalo anterior debe terminar cerca de un puerto (< 3km)
      // 4. Ese puerto debe ser diferente al puerto de origen del trayecto actual
      const prevIntervalIsNavigating = prevInterval.navStatus === "1.0"
      const currentIntervalIsAtracado = interval.navStatus === "0.0"
      const prevIntervalEndsNearPort = prevInterval.endPortDistances.nearestDistance < 3
      const prevIntervalEndPort = prevInterval.endPortDistances.nearestPort
      const isDifferentPort = journeyStartPort === null || prevIntervalEndPort !== journeyStartPort
      
      if (prevIntervalIsNavigating && currentIntervalIsAtracado && 
          prevIntervalEndsNearPort && isDifferentPort) {
        // Fin de trayecto detectado: incrementar para el próximo trayecto
        currentJourneyIndex++
        journeyStartPort = interval.startPortDistances.nearestPort
      }
    } else {
      // Primer intervalo: establecer puerto de inicio si es válido
      if (interval.navStatus === "0.0" && interval.startPortDistances.nearestDistance < 3) {
        journeyStartPort = interval.startPortDistances.nearestPort
      }
    }
    
    // Actualizar el tiempo del último intervalo para detectar gaps en el siguiente
    lastIntervalEndTime = interval.endTime
    
    return {
      ...interval,
      journeyIndex: currentJourneyIndex
    }
  })
  
  // Verificar trayectos incompletos
  const journeyGroups = new Map<number, SimpleInterval[]>()
  updatedIntervals.forEach(interval => {
    if (!journeyGroups.has(interval.journeyIndex)) {
      journeyGroups.set(interval.journeyIndex, [])
    }
    journeyGroups.get(interval.journeyIndex)!.push(interval)
  })
  
  const incompleteJourneys = new Set<number>()
  journeyGroups.forEach((intervals, journeyIndex) => {
    if (intervals.length > 0) {
      const completeness = validateJourneyCompleteness(intervals)
      if (completeness.isIncomplete) {
        incompleteJourneys.add(journeyIndex)
      }
    }
  })
  
  return { intervals: updatedIntervals, gaps, incompleteJourneys }
}

// Función para calcular la duración total de un trayecto
const calculateJourneyDuration = (intervals: SimpleInterval[]): string => {
  if (intervals.length === 0) return '0s'
  
  const firstInterval = intervals[0]
  const lastInterval = intervals[intervals.length - 1]
  
  return calculateTimeDifference(firstInterval.startTime, lastInterval.endTime)
}

const createSimpleInterval = (points: Array<{latitude: number | null, longitude: number | null, speed: number | null, timestamp: string, navStatus: string}>, startTime: string, startDate: string, intervalNumber: number): SimpleInterval | null => {
  if (points.length === 0) return null

  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]

  // Calcular distancias a todos los puertos desde el punto inicial
  const startPortDistances = calculateAllPortDistances(firstPoint.latitude!, firstPoint.longitude!)
  
  // Calcular distancias a todos los puertos desde el punto final
  const endPortDistances = calculateAllPortDistances(lastPoint.latitude!, lastPoint.longitude!)

  // Clasificar el tipo de intervalo
  const classificationType = classifyIntervalType(firstPoint.navStatus, startPortDistances, endPortDistances)

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
    console.warn('Error procesando timestamp del último punto:', error)
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
    journeyIndex: 1, // Se asignará después con assignJourneyIndexes
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
      
      // Paso 1: Convertir CSV a JSON puro usando useCSVConverter
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

      
      // Paso 2: Crear intervalos basándose en navStatus y detectar gaps en datos raw
      const rawData = csvResult.data
      
      if (!rawData || rawData.length === 0) {
        return {
          success: false,
          error: "No hay datos para procesar"
        }
      }

      const intervals: SimpleInterval[] = []
      let currentInterval: Array<{latitude: number | null, longitude: number | null, speed: number | null, timestamp: string, navStatus: string}> = []
      let intervalStartTime = ""
      let intervalStartDate = ""
      let lastTimestamp = ""
      let intervalCounter = 0

      // Procesar cada fila de datos
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i]
        const currentTime = row.timestamp
        const currentDate = row.date
        const navStatus = row.navStatus

        // Detectar gap en datos raw (excepto para el primer punto)
        let hasGapInRawData = false
        if (i > 0 && lastTimestamp) {
          const gapInfo = detectGap(currentTime, lastTimestamp)
          if (gapInfo.hasGap) {
            hasGapInRawData = true
          }
        }

        // Si es la primera fila, cambió el estado de navegación, o hay un gap en datos raw
        if (i === 0 || currentInterval.length === 0 || 
            (currentInterval.length > 0 && currentInterval[currentInterval.length - 1].navStatus !== navStatus) ||
            hasGapInRawData) {
          
          // Si había un intervalo previo, procesarlo
          if (currentInterval.length > 0) {
            intervalCounter++
            const interval = createSimpleInterval(currentInterval, intervalStartTime, intervalStartDate, intervalCounter)
            if (interval) {
              intervals.push(interval)
            }
          }
          
          // Iniciar nuevo intervalo
          currentInterval = []
          intervalStartTime = currentTime
          intervalStartDate = currentDate
        }

        // Agregar punto al intervalo actual si tiene coordenadas válidas
        if (row.latitude !== null && row.longitude !== null && 
            !isNaN(row.latitude) && !isNaN(row.longitude)) {
          
          currentInterval.push({
            latitude: row.latitude,
            longitude: row.longitude,
            timestamp: currentTime,
            speed: row.speed,
            navStatus: navStatus
          })
        }

        // Actualizar timestamp para la siguiente comparación
        lastTimestamp = currentTime
      }

      // Procesar el último intervalo
      if (currentInterval.length > 0) {
        intervalCounter++
        const interval = createSimpleInterval(currentInterval, intervalStartTime, intervalStartDate, intervalCounter)
        if (interval) {
          intervals.push(interval)
        }
      }

      // Asignar índices de trayecto
      const { intervals: intervalsWithJourneys, gaps, incompleteJourneys } = assignJourneyIndexes(intervals)

      // Agrupar intervalos por journeyIndex
      const journeyMap = new Map<number, SimpleInterval[]>()
      intervalsWithJourneys.forEach(interval => {
        if (!journeyMap.has(interval.journeyIndex)) {
          journeyMap.set(interval.journeyIndex, [])
        }
        journeyMap.get(interval.journeyIndex)!.push(interval)
      })

      // Convertir a Journey con metadata
      const journeys: Journey[] = Array.from(journeyMap.entries()).map(([journeyIndex, intervals]) => {
        const firstInterval = intervals[0]
        const lastInterval = intervals[intervals.length - 1]
        
        const startPort = firstInterval.startPortDistances.nearestPort
        const endPort = lastInterval.endPortDistances.nearestPort
        
        const completeness = validateJourneyCompleteness(intervals)
        
        return {
          journeyIndex,
          intervals,
          metadata: {
            startPort,
            endPort,
            startDate: firstInterval.startDate,
            endDate: lastInterval.endDate,
            startTime: firstInterval.startTime,
            endTime: lastInterval.endTime,
            totalDuration: calculateJourneyDuration(intervals),
            isIncomplete: completeness.isIncomplete,
            incompleteness: {
              start: !completeness.startsComplete,
              end: !completeness.endsComplete
            },
            intervalCount: intervals.length,
            classificationTypes: [...new Set(intervals.map(i => i.classificationType))]
          }
        }
      })

      // Ordenar journeys por journeyIndex
      journeys.sort((a, b) => a.journeyIndex - b.journeyIndex)

      // Contar trayectos únicos
      const uniqueJourneys = journeys.length
      const incompleteJourneyCount = journeys.filter(j => j.metadata.isIncomplete).length

      const finalResult: CSVIntervalResult = {
        success: true,
        data: {
          journeys: journeys,
          gaps: gaps,
          summary: {
            totalIntervals: intervals.length,
            totalRows: rawData.length,
            filesProcessed: csvResult.meta?.filesProcessed || 0,
            totalJourneys: uniqueJourneys,
            incompleteJourneys: incompleteJourneyCount,
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
  }

  // Estado combinado
  const isProcessingCombined = isProcessing || csvConverter.isProcessing

  return {
    results,
    isProcessing: isProcessingCombined,
    processFiles,
    clearResults,
    // Exponer también el hook CSV converter para acceso directo si es necesario
    csvConverter
  }
}
