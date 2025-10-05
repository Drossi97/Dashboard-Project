import { useState } from "react"
import { useCSVConverter, type RawDataRow } from "./useCSVConverter"

// Puerto coordinates
const PORTS = [
  { name: "Algeciras", lat: 36.128740148, lon: -5.439981128 },
  { name: "Tanger Med", lat: 35.880312709, lon: -5.515627045 },
  { name: "Ceuta", lat: 35.889, lon: -5.307 }
]

export interface PortAnalysis {
  name: string
  distance: number
}

export interface PortDistances {
  Algeciras: number
  "Tanger Med": number
  Ceuta: number
}

export interface PortAnalysisWithMin {
  Algeciras: number
  "Tanger Med": number
  Ceuta: number
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

export interface CSVIntervalResult {
  success: boolean
  data?: {
    intervals: SimpleInterval[]
    summary: {
      totalIntervals: number
      totalRows: number
      filesProcessed: number
      totalJourneys: number
      incompleteJourneys: number
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

const findNearestPort = (lat: number, lon: number): PortAnalysis => {
  let nearestPort = PORTS[0]
  let minDistance = calculateDistance(lat, lon, nearestPort.lat, nearestPort.lon)
  
  for (const port of PORTS) {
    const distance = calculateDistance(lat, lon, port.lat, port.lon)
    if (distance < minDistance) {
      minDistance = distance
      nearestPort = port
    }
  }
  
  return {
    name: nearestPort.name,
    distance: minDistance
  }
}

const calculateAllPortDistances = (lat: number, lon: number): PortAnalysisWithMin => {
  const distances = {
    Algeciras: calculateDistance(lat, lon, PORTS[0].lat, PORTS[0].lon),
    "Tanger Med": calculateDistance(lat, lon, PORTS[1].lat, PORTS[1].lon),
    Ceuta: calculateDistance(lat, lon, PORTS[2].lat, PORTS[2].lon)
  }
  
  // Encontrar el puerto más cercano
  let nearestPort = "Algeciras"
  let nearestDistance = distances.Algeciras
  
  if (distances["Tanger Med"] < nearestDistance) {
    nearestPort = "Tanger Med"
    nearestDistance = distances["Tanger Med"]
  }
  
  if (distances.Ceuta < nearestDistance) {
    nearestPort = "Ceuta"
    nearestDistance = distances.Ceuta
  }
  
  return {
    ...distances,
    nearestPort,
    nearestDistance
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

const assignJourneyIndexes = (intervals: SimpleInterval[]): { intervals: SimpleInterval[], gapInfo: Array<{ index: number, gapDuration?: string, gapReason?: string }>, incompleteJourneys: Set<number> } => {
  if (intervals.length === 0) return { intervals, gapInfo: [], incompleteJourneys: new Set<number>() }
  
  let currentJourneyIndex = 1  // Empezar desde 1 en lugar de 0
  let isFirstJourney = true
  let lastIntervalEndTime = ""
  const gapInfo: Array<{ index: number, gapDuration?: string, gapReason?: string }> = []
  
  const updatedIntervals = intervals.map((interval, index) => {
    // Detectar gap temporal entre intervalos (ya no necesario porque se detecta en datos raw)
    if (index > 0 && lastIntervalEndTime) {
      const gap = detectGap(interval.startTime, lastIntervalEndTime)
      if (gap.hasGap) {
        // Guardar información del gap para usar en las notas
        gapInfo.push({
          index: index,
          gapDuration: gap.gapDuration,
          gapReason: gap.gapReason
        })
        
        // Si hay un gap, incrementar el journeyIndex para crear un nuevo trayecto
        currentJourneyIndex++
        // console.log(`🔍 Gap detectado entre intervalos: ${gap.gapReason} (${gap.gapDuration}) - Nuevo trayecto ${currentJourneyIndex}`)
      }
    }
    
    // Verificar si es inicio de un nuevo trayecto por cambio de puerto
    const isAtracadoStart = interval.classificationType.startsWith("Atracado en")
    
    // Particularidad del primer trayecto
    if (isFirstJourney) {
      // El primer trayecto siempre comienza desde el primer intervalo (inicio incompleto)
      isFirstJourney = false
      // console.log(`🚢 Trayecto ${currentJourneyIndex}: Inicio incompleto`)
      
        // Si el primer intervalo está atracado, el siguiente trayecto comenzará en el próximo que esté atracado en un puerto diferente
        if (isAtracadoStart) {
          // Verificar si el siguiente intervalo está atracado en un puerto diferente
          const nextInterval = intervals[index + 1]
          if (nextInterval && nextInterval.classificationType.startsWith("Atracado en")) {
            const currentPort = interval.classificationType.replace("Atracado en ", "")
            const nextPort = nextInterval.classificationType.replace("Atracado en ", "")
            if (currentPort !== nextPort) {
              currentJourneyIndex++
              // console.log(`🚢 Trayecto ${currentJourneyIndex}: ${currentPort} → ${nextPort}`)
            }
          }
        }
    } else {
      // Para trayectos subsecuentes, incrementar si está atracado en un puerto diferente al anterior
      if (isAtracadoStart) {
        // Verificar si el intervalo anterior tiene gap
        const hasGapBefore = gapInfo.some(gap => gap.index === index)
        if (!hasGapBefore) {
          // Buscar el último intervalo atracado para comparar puertos
          let foundPreviousAtracado = false
          for (let i = index - 1; i >= 0; i--) {
            const prevInterval = intervals[i]
            if (prevInterval.classificationType.startsWith("Atracado en")) {
              foundPreviousAtracado = true
              const currentPort = interval.classificationType.replace("Atracado en ", "")
              const prevPort = prevInterval.classificationType.replace("Atracado en ", "")
              if (currentPort !== prevPort) {
                currentJourneyIndex++
                // console.log(`🚢 Trayecto ${currentJourneyIndex}: ${prevPort} → ${currentPort}`)
              }
              break
            }
          }
          
          // Si no se encontró un intervalo anterior atracado, significa que el trayecto anterior era incompleto
          // Por lo tanto, este debe ser un nuevo trayecto
          if (!foundPreviousAtracado) {
                currentJourneyIndex++
                // console.log(`🚢 Trayecto ${currentJourneyIndex}: Nuevo trayecto después de trayecto incompleto`)
          }
        }
      }
    }
    
    // Actualizar el tiempo del último intervalo para detectar gaps en el siguiente
    lastIntervalEndTime = interval.endTime
    
    return {
      ...interval,
      journeyIndex: currentJourneyIndex
    }
  })
  
  // Marcar el último trayecto como incompleto si no termina en un puerto
  const lastInterval = updatedIntervals[updatedIntervals.length - 1]
  if (lastInterval && !lastInterval.classificationType.startsWith("Atracado en")) {
    // console.log(`🚢 Trayecto ${lastInterval.journeyIndex}: Final incompleto`)
  }
  
  // Verificar trayectos incompletos en el medio (que no terminan en puerto)
  const journeyGroups = new Map<number, SimpleInterval[]>()
  updatedIntervals.forEach(interval => {
    if (!journeyGroups.has(interval.journeyIndex)) {
      journeyGroups.set(interval.journeyIndex, [])
    }
    journeyGroups.get(interval.journeyIndex)!.push(interval)
  })
  
  // Marcar trayectos incompletos que no tienen un intervalo "Atracado" que los siga
  // O que no tienen puertos de origen y destino válidos
  const incompleteJourneys = new Set<number>()
  journeyGroups.forEach((intervals, journeyIndex) => {
    if (intervals.length > 0) {
      const firstInterval = intervals[0]
      const lastIntervalInJourney = intervals[intervals.length - 1]
      const lastIntervalIndex = updatedIntervals.findIndex(interval => interval === lastIntervalInJourney)
      
      // Verificar si tiene puertos de origen y destino válidos
      const startPort = firstInterval.startPortDistances?.nearestPort
      const endPort = lastIntervalInJourney.endPortDistances?.nearestPort
      const hasValidPorts = startPort && endPort && startPort !== 'Desconocido' && endPort !== 'Desconocido'
      
      // Verificar si es un trayecto circular (mismo puerto origen y destino)
      // Esto indica que no tenemos la información completa del trayecto real
      const isCircularJourney = startPort === endPort && startPort !== 'Desconocido'
      
      // Buscar si hay un intervalo "Atracado" después del último intervalo de este trayecto
      let hasAtracadoAfter = false
      for (let i = lastIntervalIndex + 1; i < updatedIntervals.length; i++) {
        const nextInterval = updatedIntervals[i]
        if (nextInterval.classificationType.startsWith("Atracado en")) {
          hasAtracadoAfter = true
          // console.log(`🚢 Trayecto ${journeyIndex}: Finalizado (siguiente intervalo atracado en ${nextInterval.classificationType.replace("Atracado en ", "")})`)
          break
        }
      }
      
      // El trayecto está incompleto si:
      // 1. No hay un intervalo "Atracado" después, O
      // 2. No tiene puertos de origen y destino válidos, O
      // 3. Es un trayecto circular (mismo puerto origen y destino)
      if (!hasAtracadoAfter || !hasValidPorts || isCircularJourney) {
        incompleteJourneys.add(journeyIndex)
        if (!hasAtracadoAfter) {
          // console.log(`🚢 Trayecto ${journeyIndex}: Trayecto incompleto (no hay intervalo atracado que lo siga)`)
        }
        if (!hasValidPorts) {
          // console.log(`🚢 Trayecto ${journeyIndex}: Trayecto incompleto (puertos inválidos: ${startPort} → ${endPort})`)
        }
        if (isCircularJourney) {
          // console.log(`🚢 Trayecto ${journeyIndex}: Trayecto incompleto (trayecto circular: ${startPort} → ${endPort} - información incompleta)`)
        }
      }
    }
  })
  
  return { intervals: updatedIntervals, gapInfo, incompleteJourneys }
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

  const interval: SimpleInterval = {
    startDate: startDate,
    startTime: startTime,
    endDate: lastPoint.timestamp.split(' ')[0],
    endTime: lastPoint.timestamp,
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
      // console.log('=== PROCESANDO ARCHIVOS CSV CON useCSVInterval - CREANDO INTERVALOS ===')
      
      // Paso 1: Convertir CSV a JSON puro usando useCSVConverter
      // console.log('1. Convirtiendo CSV a JSON...')
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

      // console.log(`✅ CSV convertido: ${csvResult.data.length} filas`)
      
      // Paso 2: Crear intervalos basándose en navStatus y detectar gaps en datos raw
      // console.log('2. Creando intervalos basándose en navStatus y detectando gaps...')
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
            // console.log(`🔍 Gap detectado en datos raw: ${gapInfo.gapReason} (${gapInfo.gapDuration}) en fila ${i}`)
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
      // console.log('3. Asignando índices de trayecto...')
      const { intervals: intervalsWithJourneys, gapInfo, incompleteJourneys } = assignJourneyIndexes(intervals)

      // Crear estructura con marcas de separación entre intervalos
      const intervalsWithSeparators: any[] = []
      
      intervalsWithJourneys.forEach((interval, index) => {
        // Agregar marca de separación antes de cada intervalo (incluyendo el primero)
        let note = `Inicio del intervalo ${index + 1} - Trayecto ${interval.journeyIndex}`
        
        // Buscar información de gap para este intervalo
        const gapForThisInterval = gapInfo.find(gap => gap.index === index)
        let hasGap = false
        let gapDuration = undefined
        let gapReason = undefined
        
        if (gapForThisInterval) {
          hasGap = true
          gapDuration = gapForThisInterval.gapDuration
          gapReason = gapForThisInterval.gapReason
          note += ` [GAP: ${gapForThisInterval.gapReason} - ${gapForThisInterval.gapDuration}]`
        }
        
        intervalsWithSeparators.push({
          separator: "===============",
          intervalNumber: index + 1,
          classificationType: interval.classificationType,
          journeyIndex: interval.journeyIndex,
          hasGap: hasGap,
          gapDuration: gapDuration,
          gapReason: gapReason,
          isIncomplete: incompleteJourneys.has(interval.journeyIndex),
          note: note
        })
        
        // Agregar el intervalo manteniendo journeyIndex y classificationType
        intervalsWithSeparators.push(interval)
      })

      // Contar trayectos únicos
      const uniqueJourneys = new Set(intervalsWithJourneys.map(i => i.journeyIndex)).size
      const incompleteJourneyCount = incompleteJourneys.size

      const finalResult: CSVIntervalResult = {
        success: true,
        data: {
          intervals: intervalsWithSeparators,
          summary: {
            totalIntervals: intervals.length,
            totalRows: rawData.length,
            filesProcessed: csvResult.meta?.filesProcessed || 0,
            totalJourneys: uniqueJourneys,
            incompleteJourneys: incompleteJourneyCount
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
      // console.log(`✅ Procesamiento completado: ${intervals.length} intervalos, ${uniqueJourneys} trayectos (${incompleteJourneyCount} incompletos)`)
      return finalResult

    } catch (error) {
      // console.error('Error procesando archivos:', error)
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
