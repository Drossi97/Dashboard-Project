import React from "react"
import { CSVIntervalResult } from "../hooks/useCSVInterval"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Brush, Tooltip } from 'recharts'
import { parseDurationToSeconds } from "../lib/utils"

interface SpeedProfileProps {
  csvResults: CSVIntervalResult | null
  selectedJourneys: Set<number>
  isVisible: boolean
  onClose: () => void
  onViewChange?: (view: 'speed' | 'activity' | 'comparison') => void
}

interface IntervalData {
  classificationType: string
  duration: string
  durationInSeconds: number
  journeyIndex: number
  intervalNumber: number
  startTime?: string
  endTime?: string
  startDate?: string
  endDate?: string
  avgSpeed?: number | null
  navStatus?: string
}

interface SpeedDataPoint {
  time: string
  timestamp: number
  fullDateTime?: string
  speed: number | null
  avgSpeed?: number | null
  navStatus: string
  stateValue: number | null
  stateValueScaled: number | null
  classificationType: string
  intervalNumber: number
  journeyIndex: number
  duration: string
  startTime: string
  endTime: string
  journeyStartDateTime?: string
  journeyEndDateTime?: string
}


// Función para extraer datos de intervalos desde journeys
const extractIntervalData = (csvResults: CSVIntervalResult | null, selectedJourneys: Set<number>): IntervalData[] => {
  if (!csvResults?.success || !csvResults.data?.journeys || selectedJourneys.size === 0) {
    return []
  }

  const intervalData: IntervalData[] = []
  
  csvResults.data.journeys.forEach((journey) => {
    if (selectedJourneys.has(journey.journeyIndex)) {
      journey.intervals.forEach((interval, intervalIndex) => {
        intervalData.push({
          classificationType: interval.classificationType,
          duration: interval.duration,
          durationInSeconds: parseDurationToSeconds(interval.duration),
          journeyIndex: journey.journeyIndex,
          intervalNumber: intervalIndex + 1,
          startTime: interval.startTime,
          endTime: interval.endTime,
          startDate: interval.startDate,
          endDate: interval.endDate,
          avgSpeed: interval.avgSpeed,
          navStatus: interval.navStatus
        })
      })
    }
  })
  
  return intervalData
}

// Función para preparar datos de velocidad híbrida (puntos GPS + estado de intervalo)
// Nueva función que retorna dataset unificado con gaps explícitos
const prepareSpeedDataWithGaps = (csvResults: CSVIntervalResult | null, selectedJourneys: Set<number>): SpeedDataPoint[] => {
  const allPoints: SpeedDataPoint[] = []
  
  if (!csvResults?.success || !csvResults.data?.journeys || selectedJourneys.size === 0) {
    return allPoints
  }

  const sortedJourneyIndices = Array.from(selectedJourneys).sort((a, b) => a - b)
  
  sortedJourneyIndices.forEach((journeyIndex, idx) => {
    const journey = csvResults.data?.journeys.find(j => j.journeyIndex === journeyIndex)
    if (!journey) return
    
    const journeyIntervals = journey.intervals || []

  // Ordenar intervalos por timestamp
    journeyIntervals.sort((a, b) => {
      const timeA = new Date(`${a.startDate} ${a.startTime}`).getTime()
      const timeB = new Date(`${b.startDate} ${b.startTime}`).getTime()
    return timeA - timeB
  })

    let lastTimestamp = 0
    
    journeyIntervals.forEach((interval, intervalIndex) => {
    const navStatus = interval.navStatus || '0.0'
    let navStatusValue = 0
      
    if (typeof navStatus === 'string') {
      if (navStatus === '0.0' || navStatus === '0' || navStatus === 'Parado') {
        navStatusValue = 0
      } else if (navStatus === '1.0' || navStatus === '1' || navStatus === 'Maniobrando') {
        navStatusValue = 1
      } else if (navStatus === '2.0' || navStatus === '2' || navStatus === 'Navegando') {
        navStatusValue = 2
      }
    } else if (typeof navStatus === 'number') {
      navStatusValue = navStatus
    }
    
    const avgSpeed = interval.avgSpeed || 0
    const coordinatePoints = interval.coordinatePoints || []
    
    if (coordinatePoints.length === 0) {
        // No coordinate points, use interval start/end times
      const startTimestamp = new Date(`${interval.startDate} ${interval.startTime}`).getTime()
      const endTimestamp = new Date(`${interval.endDate} ${interval.endTime}`).getTime()
      
      if (!isNaN(startTimestamp) && !isNaN(endTimestamp)) {
          allPoints.push({
          time: interval.startTime || '00:00',
          timestamp: startTimestamp,
          fullDateTime: `${interval.startDate} ${interval.startTime}`,
          speed: avgSpeed,
          avgSpeed: avgSpeed,
          navStatus: navStatus,
          stateValue: navStatusValue,
          stateValueScaled: navStatusValue,
          classificationType: interval.classificationType,
          intervalNumber: interval.intervalNumber,
          journeyIndex: journeyIndex,
          duration: interval.duration,
          startTime: interval.startTime || '00:00',
          endTime: interval.endTime || '00:00'
        })
        
          allPoints.push({
          time: interval.endTime || '00:00',
          timestamp: endTimestamp,
          fullDateTime: `${interval.endDate} ${interval.endTime}`,
          speed: avgSpeed,
          avgSpeed: avgSpeed,
          navStatus: navStatus,
          stateValue: navStatusValue,
          stateValueScaled: navStatusValue,
          classificationType: interval.classificationType,
          intervalNumber: interval.intervalNumber,
          journeyIndex: journeyIndex,
          duration: interval.duration,
          startTime: interval.startTime || '00:00',
          endTime: interval.endTime || '00:00'
        })
          
          lastTimestamp = endTimestamp
      }
    } else {
        // Use coordinate points with sampling
        const maxPointsPerInterval = 20
      const samplingRate = Math.max(1, Math.floor(coordinatePoints.length / maxPointsPerInterval))
      
      const sampledPoints = []
      if (coordinatePoints[0]) {
        sampledPoints.push(coordinatePoints[0])
      }
      
      for (let i = samplingRate; i < coordinatePoints.length - 1; i += samplingRate) {
        sampledPoints.push(coordinatePoints[i])
      }
      
      if (coordinatePoints.length > 1 && coordinatePoints[coordinatePoints.length - 1]) {
        sampledPoints.push(coordinatePoints[coordinatePoints.length - 1])
      }
      
      sampledPoints.forEach((point, pointIndex) => {
        if (point.speed !== null && point.speed !== undefined) {
          const timestamp = new Date(point.timestamp).getTime()
          if (isNaN(timestamp)) return
          
            allPoints.push({
            time: new Date(point.timestamp).toLocaleTimeString('es-ES', { 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit',
              hour12: false 
            }),
            timestamp,
            fullDateTime: point.timestamp,
              speed: point.speed,
              avgSpeed: avgSpeed,
              navStatus: navStatus,
            stateValue: navStatusValue,
            stateValueScaled: navStatusValue,
            classificationType: interval.classificationType,
            intervalNumber: interval.intervalNumber,
            journeyIndex: journeyIndex,
            duration: interval.duration,
            startTime: interval.startTime || '00:00',
            endTime: interval.endTime || '00:00'
          })
            
            lastTimestamp = timestamp
        }
      })
    }
  })
  
    // Add gap point if next journey is not contiguous
    if (idx < sortedJourneyIndices.length - 1) {
      const nextJourneyIndex = sortedJourneyIndices[idx + 1]
      if (nextJourneyIndex !== journeyIndex + 1) {
        // Add null point to create visual gap
        allPoints.push({
          time: 'GAP',
          timestamp: lastTimestamp + 1,
          fullDateTime: new Date(lastTimestamp + 1).toISOString(),
          speed: null,
          avgSpeed: null,
          navStatus: 'GAP',
          stateValue: null,
          stateValueScaled: null,
          classificationType: 'GAP',
          intervalNumber: -1,
          journeyIndex: -1,
          duration: '0s',
          startTime: 'GAP',
          endTime: 'GAP'
        })
      }
    }
  })
  
  return allPoints.sort((a, b) => a.timestamp - b.timestamp)
}

const SpeedProfile: React.FC<SpeedProfileProps> = ({ csvResults, selectedJourneys, isVisible, onClose, onViewChange }) => {
  const [selectedDataPoint, setSelectedDataPoint] = React.useState<SpeedDataPoint | null>(null)
  const [brushRange, setBrushRange] = React.useState<[number, number] | null>(null)
  const [shouldResetView, setShouldResetView] = React.useState(false)
  const [showSpeedLine, setShowSpeedLine] = React.useState(true)
  const [showAvgSpeedLine, setShowAvgSpeedLine] = React.useState(true)
  const [showStateLine, setShowStateLine] = React.useState(true)
  const [showJourneyLines, setShowJourneyLines] = React.useState(true)
  const [showIntervalLines, setShowIntervalLines] = React.useState(false)

  const brushChangeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Cleanup effect para limpiar timeouts
  React.useEffect(() => {
    return () => {
      if (brushChangeTimeoutRef.current) {
        clearTimeout(brushChangeTimeoutRef.current)
      }
    }
  }, [])

  // Resetear vista cuando cambien los trayectos seleccionados
  React.useEffect(() => {
    if (selectedJourneys.size > 0) {
      setBrushRange(null) // Resetear el brush a vista completa
      setSelectedDataPoint(null) // Limpiar selección
      setShouldResetView(true) // Marcar que se debe resetear la vista
    }
  }, [selectedJourneys])

  // Resetear vista cuando se carguen nuevos datos CSV
  React.useEffect(() => {
    if (csvResults?.success && csvResults.data?.journeys) {
      setBrushRange(null) // Resetear el brush a vista completa
      setSelectedDataPoint(null) // Limpiar selección
      setShouldResetView(true) // Marcar que se debe resetear la vista
    }
  }, [csvResults])

  // Extraer datos de intervalos
  const intervalData = React.useMemo(() => {
    const data = extractIntervalData(csvResults, selectedJourneys)
    return data
  }, [csvResults, selectedJourneys])

  // Preparar datos de velocidad unificados con gaps
  const speedData = React.useMemo(() => 
    prepareSpeedDataWithGaps(csvResults, selectedJourneys), 
    [csvResults, selectedJourneys]
  )

  // Configuración dinámica del eje Y para velocidad
  const speedAxisConfig = React.useMemo(() => {
    if (speedData.length === 0) return { domain: [0, 20], ticks: [0, 5, 10, 15, 20] }
    
    const maxSpeed = Math.max(...speedData.map(d => d.speed || 0))
    const roundedMax = Math.ceil(maxSpeed / 5) * 5
    const finalMax = Math.max(roundedMax + 5, 20)
    
    const ticks = []
    for (let i = 0; i <= finalMax; i += 5) {
      ticks.push(i)
    }
    
    return { domain: [0, finalMax], ticks }
  }, [speedData])

  // Configuración del eje Y para estado
  const stateAxisConfig = React.useMemo(() => {
    return {
      domain: [0, 20], // Fijo para estados 0, 10, 20
      ticks: [0, 10, 20] // Parado, Maniobrando, Navegando
    }
  }, [])

  // Identificar cambios de trayecto e intervalo para líneas verticales
  const changePoints = React.useMemo(() => {
    if (speedData.length === 0) return []
    
    const changes: Array<{
      timestamp: number
      type: 'journey' | 'interval'
      from: number
      to: number
      label: string
    }> = []
    let lastJourney: number | null = null
    let lastInterval: number | null = null
    
    speedData.forEach((point, index) => {
      const currentJourney = point.journeyIndex
      const currentInterval = point.intervalNumber
      
      // Ignorar puntos de gap (journeyIndex: -1, intervalNumber: -1)
      if (currentJourney === -1 || currentInterval === -1) {
        return
      }
      
      // Detectar cambio de trayecto (solo mostrar cambios importantes)
      if (lastJourney !== null && currentJourney !== lastJourney && lastJourney !== -1) {
        changes.push({
          timestamp: point.timestamp,
          type: 'journey',
          from: lastJourney,
          to: currentJourney,
          label: `Trayecto ${lastJourney} → ${currentJourney}`
        })
      }
      
      // Detectar cambio de intervalo (mostrar todos los cambios)
      if (lastInterval !== null && currentInterval !== lastInterval && lastInterval !== -1) {
        changes.push({
          timestamp: point.timestamp,
          type: 'interval',
          from: lastInterval,
          to: currentInterval,
          label: `#${lastInterval} → #${currentInterval}`
        })
      }
      
      lastJourney = currentJourney
      lastInterval = currentInterval
    })
    
    return changes
  }, [speedData])

  // Filtrar puntos de cambio según visibilidad
  const visibleChangePoints = React.useMemo(() => {
    return changePoints.filter(change => {
      if (change.type === 'journey') return showJourneyLines
      if (change.type === 'interval') return showIntervalLines
      return true
    })
  }, [changePoints, showJourneyLines, showIntervalLines])

  // Datos escalados para el estado
  const scaledSpeedData = React.useMemo(() => {
    return speedData.map(point => ({
      ...point,
      stateValueScaled: point.stateValue !== null ? (point.stateValue || 0) * 10 : null // Escalar 0,1,2 a 0,10,20, mantener null para discontinuidades
    }))
  }, [speedData])

  // Datos con zoom aplicado - usar datos combinados para el brush y cálculos
  const zoomedData = React.useMemo(() => {
    if (!brushRange || speedData.length === 0) return scaledSpeedData
    
    const [startIndex, endIndex] = brushRange
    return scaledSpeedData.slice(startIndex, endIndex + 1)
  }, [scaledSpeedData, brushRange])
  

  // Deshabilitar todas las animaciones para una experiencia más simple
  const shouldDisableAnimations = true

  // Ticks del eje X cada 5 minutos
  const xAxisTicks = React.useMemo(() => {
    if (zoomedData.length === 0) return []
    
    const startTime = zoomedData[0].timestamp
    const endTime = zoomedData[zoomedData.length - 1].timestamp
    const interval = 5 * 60 * 1000 // 5 minutos en milisegundos
    
    const ticks = []
    for (let time = startTime; time <= endTime; time += interval) {
      ticks.push(time)
    }
    
    return ticks
  }, [zoomedData])

  // Eje para Trayectos: ticks en el INICIO de cada segmento (sincronizado con zoom)
  const { journeyTicks, journeyLabelMap } = React.useMemo(() => {
    const ticks: number[] = []
    const labelMap = new Map<number, string>()
    const data = zoomedData.filter(p => p.journeyIndex !== -1)
    if (data.length === 0) return { journeyTicks: ticks, journeyLabelMap: labelMap }

    let currentJourney = data[0].journeyIndex
    // Primer segmento: añadir etiqueta al inicio
    ticks.push(data[0].timestamp)
    labelMap.set(data[0].timestamp, `T${currentJourney}`)

    for (let i = 1; i < data.length; i++) {
      const p = data[i]
      if (p.journeyIndex !== currentJourney) {
        // Nuevo trayecto: etiquetar en el inicio de este segmento
        ticks.push(p.timestamp)
        labelMap.set(p.timestamp, `T${p.journeyIndex}`)
        currentJourney = p.journeyIndex
      }
    }

    return { journeyTicks: ticks, journeyLabelMap: labelMap }
  }, [zoomedData])

  // Eje para Intervalos: ticks en el INICIO de cada segmento (sincronizado con zoom)
  const { intervalTicks, intervalLabelMap } = React.useMemo(() => {
    const ticks: number[] = []
    const labelMap = new Map<number, string>()
    const data = zoomedData.filter(p => p.intervalNumber !== -1)
    if (data.length === 0) return { intervalTicks: ticks, intervalLabelMap: labelMap }

    let currentInterval = data[0].intervalNumber
    // Primer segmento: añadir etiqueta al inicio
    ticks.push(data[0].timestamp)
    labelMap.set(data[0].timestamp, `I${currentInterval}`)

    for (let i = 1; i < data.length; i++) {
      const p = data[i]
      if (p.intervalNumber !== currentInterval) {
        // Nuevo intervalo: etiquetar en el inicio de este segmento
        ticks.push(p.timestamp)
        labelMap.set(p.timestamp, `I${p.intervalNumber}`)
        currentInterval = p.intervalNumber
      }
    }

    return { intervalTicks: ticks, intervalLabelMap: labelMap }
  }, [zoomedData])

  // Función para interpolación suave del cursor
  const getInterpolatedTimestamp = React.useCallback((mouseX: number, chartWidth: number, data: any[]) => {
    if (data.length === 0) return null
    
    const startTime = data[0].timestamp
    const endTime = data[data.length - 1].timestamp
    const timeRange = endTime - startTime
    
    // Considerar que el área de datos no ocupa todo el ancho debido a los márgenes
    // Margen derecho: 30px, margen izquierdo: 0px (ya lo eliminamos)
    const dataAreaWidth = chartWidth - 30 // Solo restamos el margen derecho
    const relativeX = Math.max(0, Math.min(1, mouseX / dataAreaWidth))
    const interpolatedTime = startTime + (timeRange * relativeX)
    
    return Math.max(startTime, Math.min(endTime, interpolatedTime))
  }, [])

  // Función para obtener la posición del cursor considerando el brush
  const getCursorPositionFromBrush = React.useCallback((mouseX: number, chartWidth: number) => {
    if (!brushRange || scaledSpeedData.length === 0) return null
    
    const startIndex = brushRange[0]
    const endIndex = brushRange[1]
    const brushData = scaledSpeedData.slice(startIndex, endIndex + 1)
    
    if (brushData.length === 0) return null
    
    const startTime = brushData[0].timestamp
    const endTime = brushData[brushData.length - 1].timestamp
    const timeRange = endTime - startTime
    
    // Considerar que el área de datos no ocupa todo el ancho debido a los márgenes
    // Margen derecho: 30px, margen izquierdo: 0px (ya lo eliminamos)
    const dataAreaWidth = chartWidth - 30 // Solo restamos el margen derecho
    const relativeX = Math.max(0, Math.min(1, mouseX / dataAreaWidth))
    const interpolatedTime = startTime + (timeRange * relativeX)
    
    return Math.max(startTime, Math.min(endTime, interpolatedTime))
  }, [brushRange, scaledSpeedData])

  // Manejar cambios del brush
  const handleBrushChange = React.useCallback((brushData: any) => {
    if (brushChangeTimeoutRef.current) {
      clearTimeout(brushChangeTimeoutRef.current)
    }
    
    brushChangeTimeoutRef.current = setTimeout(() => {
      if (brushData && brushData.startIndex !== undefined && brushData.endIndex !== undefined) {
        setBrushRange([brushData.startIndex, brushData.endIndex])
        setSelectedDataPoint(null)
      } else {
        setBrushRange(null)
      }
      setShouldResetView(false) // Marcar que ya no se necesita resetear
    }, 100)
  }, [])

  if (!isVisible) return null

  return (
    <div className="fixed top-4 left-4 z-[999998] dashboard-component">
      <div className="w-[calc(100vw-23rem)] max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] rounded-xl p-4 shadow-2xl border border-gray-700 overflow-hidden" style={{ backgroundColor: '#1F2937' }}>
        <div className="flex flex-col h-full">
          {/* Encabezado con pestañas y botón de cerrar */}
          <div className="flex items-center justify-between mb-4">
            {/* Pestañas de navegación */}
            {onViewChange && (
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  className="flex items-center gap-2 px-4 py-2 text-white text-sm rounded-md shadow-sm transition-all duration-200"
                  style={{ backgroundColor: '#2563EB' }}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Perfil de Velocidad
                </button>
                <button
                  onClick={() => onViewChange('activity')}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 text-sm rounded-md transition-all duration-200"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                  Distribución de Actividades
                </button>
                <button
                  onClick={() => onViewChange('comparison')}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 text-sm rounded-md transition-all duration-200"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Comparación de Trayectos
                </button>
              </div>
            )}
            
            {/* Botón de cerrar */}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>


          {/* Brush de navegación simplificado */}
          {speedData.length > 0 && (
            <div 
              className="mb-3 rounded-lg px-2 py-2"
              style={{ backgroundColor: '#2D3748' }}
            >
              <style dangerouslySetInnerHTML={{
                __html: `
                  /* Ocultar marco/borde del contenedor del brush */
                  .brush-container {
                    border: none !important;
                    outline: none !important;
                  }
                  
                  .brush-container .recharts-brush {
                    background-color: #2D3748 !important;
                    border: none !important;
                    outline: none !important;
                  }
                  
                  .brush-container .recharts-surface {
                    background-color: #2D3748 !important;
                    border: none !important;
                    outline: none !important;
                  }
                  
                  .brush-container .recharts-wrapper {
                    background-color: #2D3748 !important;
                    border: none !important;
                    outline: none !important;
                  }
                  
                  /* Brush slide con bordes redondeados */
                  .brush-container .recharts-brush-slide {
                    fill: #818791 !important;
                    stroke: #A5AAB1 !important;
                    stroke-width: 2px !important;
                    rx: 8 !important;
                    ry: 8 !important;
                    border-radius: 8px !important;
                  }
                  
                  .brush-container .recharts-brush-slide:hover {
                    fill: #9CA3AF !important;
                    stroke: #D1D5DB !important;
                    stroke-width: 2px !important;
                    rx: 8 !important;
                    ry: 8 !important;
                  }
                  
                  .brush-container .recharts-brush-slide rect {
                    fill: #818791 !important;
                    rx: 8 !important;
                    ry: 8 !important;
                    border-radius: 8px !important;
                  }
                  
                  .brush-container .recharts-brush-slide:hover rect {
                    fill: #9CA3AF !important;
                    rx: 8 !important;
                    ry: 8 !important;
                  }
                  
                  /* Travellers (manejadores) con bordes redondeados */
                  .brush-container .recharts-brush-traveller {
                    fill: #2D3748 !important;
                    stroke: #D1D5DB !important;
                    stroke-width: 2px !important;
                    rx: 4 !important;
                    ry: 4 !important;
                    border-radius: 4px !important;
                  }
                  
                  .brush-container .recharts-brush-traveller:hover {
                    fill: #374151 !important;
                    stroke: #F3F4F6 !important;
                    stroke-width: 2px !important;
                    rx: 4 !important;
                    ry: 4 !important;
                  }
                  
                  .brush-container .recharts-brush-traveller rect {
                    fill: #2D3748 !important;
                    stroke: #D1D5DB !important;
                    stroke-width: 1px !important;
                    rx: 4 !important;
                    ry: 4 !important;
                    border-radius: 4px !important;
                  }
                  
                  .brush-container .recharts-brush-traveller:hover rect {
                    fill: #374151 !important;
                    stroke: #F3F4F6 !important;
                    stroke-width: 1px !important;
                    rx: 4 !important;
                    ry: 4 !important;
                  }
                  
                  /* Ocultar cualquier borde o marco no deseado */
                  .brush-container svg {
                    background-color: transparent !important;
                    border: none !important;
                    outline: none !important;
                  }
                  
                  .brush-container svg rect:not(.recharts-brush-slide):not(.recharts-brush-traveller rect) {
                    stroke: none !important;
                    fill: transparent !important;
                  }
                `
              }} />
              <div className="brush-container">
                <ResponsiveContainer width="100%" height={32}>
                  <LineChart 
                    data={scaledSpeedData}
                    margin={{ top: 1, right: 2, left: 2, bottom: 1 }}
                  >
                    <Brush
                      dataKey="timestamp"
                      height={30}
                      stroke="rgba(255,255,255,0.6)"
                      fill="rgba(255,255,255,0.25)"
                      fillOpacity={1}
                      onChange={handleBrushChange}
                      startIndex={shouldResetView ? 0 : (brushRange ? brushRange[0] : 0)}
                      endIndex={shouldResetView ? scaledSpeedData.length - 1 : (brushRange ? brushRange[1] : scaledSpeedData.length - 1)}
                      tickFormatter={() => ''}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Gráfica principal */}
          <div className="rounded-xl p-3 border border-gray-800 flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: '#2D3748' }}>
            {/* Leyenda integrada */}
            <div className="flex items-center justify-center gap-4 mb-3 flex-wrap">
              <button
                onClick={() => setShowSpeedLine(!showSpeedLine)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors duration-200"
              >
                <div 
                  className="w-3 h-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: showSpeedLine ? '#00BFFF' : '#2D3748' }}
                ></div>
                <span 
                  className="text-xs font-medium whitespace-nowrap"
                  style={{ color: showSpeedLine ? '#00BFFF' : '#9CA3AF' }}
                >
                  Velocidad
                </span>
              </button>
              
              <button
                onClick={() => setShowAvgSpeedLine(!showAvgSpeedLine)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors duration-200"
              >
                <div 
                  className="w-3 h-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: showAvgSpeedLine ? '#00FFFF' : '#2D3748' }}
                ></div>
                <span 
                  className="text-xs font-medium whitespace-nowrap"
                  style={{ color: showAvgSpeedLine ? '#00FFFF' : '#9CA3AF' }}
                >
                  Velocidad Media
                </span>
              </button>
              
              <button
                onClick={() => setShowStateLine(!showStateLine)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors duration-200"
              >
                <div 
                  className="w-3 h-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: showStateLine ? '#32CD32' : '#2D3748' }}
                ></div>
                <span 
                  className="text-xs font-medium whitespace-nowrap"
                  style={{ color: showStateLine ? '#32CD32' : '#9CA3AF' }}
                >
                  Estado
                </span>
              </button>

              <div className="w-px h-6 bg-gray-600 mx-2"></div>

              <button
                onClick={() => setShowJourneyLines(!showJourneyLines)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors duration-200"
              >
                <div 
                  className="w-3 h-0.5 rounded-full flex-shrink-0"
                  style={{ 
                    backgroundColor: showJourneyLines ? '#FF6B6B' : '#2D3748',
                    backgroundImage: showJourneyLines ? 'repeating-linear-gradient(90deg, #FF6B6B 0px, #FF6B6B 5px, transparent 5px, transparent 10px)' : 'none'
                  }}
                ></div>
                <span 
                  className="text-xs font-medium whitespace-nowrap"
                  style={{ color: showJourneyLines ? '#FF6B6B' : '#9CA3AF' }}
                >
                  Trayectos
                </span>
              </button>

              <button
                onClick={() => setShowIntervalLines(!showIntervalLines)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors duration-200"
              >
                <div 
                  className="w-3 h-0.5 rounded-full flex-shrink-0"
                  style={{ 
                    backgroundColor: showIntervalLines ? '#FFA500' : '#2D3748',
                    backgroundImage: showIntervalLines ? 'repeating-linear-gradient(90deg, #FFA500 0px, #FFA500 3px, transparent 3px, transparent 6px)' : 'none'
                  }}
                ></div>
                <span 
                  className="text-xs font-medium whitespace-nowrap"
                  style={{ color: showIntervalLines ? '#FFA500' : '#9CA3AF' }}
                >
                  Intervalos
                </span>
              </button>
            </div>
            
            <div className="h-[calc(100%-3rem)] min-h-0 relative flex flex-col">
              {speedData.length > 0 ? (
                <>
                <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={zoomedData}
                    margin={{
                        top: 50,
                      right: 30,
                        left: 0,
                      bottom: 50,
                    }}
                    onMouseMove={(chartState, event) => {
                      if (chartState && chartState.activePayload && chartState.activePayload.length > 0) {
                        setSelectedDataPoint(chartState.activePayload[0].payload)
                      }
                    }}
                    onMouseLeave={() => {
                      setSelectedDataPoint(null)
                    }}
                  >
                    {/* Cursor vertical */}
                    <defs>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="2 8" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={0.5} />
                    
                    {/* Tooltip para activar los puntos sin mostrar cursor */}
                    <Tooltip
                      cursor={false}
                      content={() => null}
                    />
                    
                    {/* Eje principal X: Tiempo (inferior) */}
                    <XAxis 
                      dataKey="timestamp" 
                      type="number" 
                      scale="linear" 
                      stroke="#FFFFFF" 
                      strokeWidth={1}
                      fontSize={11}
                      tick={{ fill: '#FFFFFF' }}
                      tickCount={8}
                      domain={['auto', 'auto']}
                      ticks={xAxisTicks}
                      label={undefined}
                      tickFormatter={(value) => {
                        const date = new Date(value)
                        return date.toLocaleTimeString('es-ES', { 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: false 
                        })
                      }}
                    />
                    
                    {/* Eje superior: Intervalos (más cerca del gráfico) */}
                    <XAxis
                      xAxisId="intervalAxis"
                      dataKey="timestamp"
                      type="number"
                      scale="linear"
                      orientation="top"
                      axisLine={{ stroke: '#FFFFFF', strokeWidth: 1 }}
                      tickLine={{ stroke: '#FFFFFF', strokeWidth: 1 }}
                      tick={{ fill: '#FFFFFF', fontSize: 10, fontWeight: 600 }}
                      domain={['auto', 'auto']}
                      ticks={intervalTicks}
                      tickFormatter={(value) => intervalLabelMap.get(value as number) || ''}
                      allowDataOverflow={true}
                    />

                    {/* Eje superior: Trayectos (más arriba) */}
                    <XAxis
                      xAxisId="journeyAxis"
                      dataKey="timestamp"
                      type="number"
                      scale="linear"
                      orientation="top"
                      axisLine={{ stroke: '#FFFFFF', strokeWidth: 1 }}
                      tickLine={{ stroke: '#FFFFFF', strokeWidth: 1 }}
                      tick={{ fill: '#FFFFFF', fontSize: 10, fontWeight: 600, dy: -15 }}
                      domain={['auto', 'auto']}
                      ticks={journeyTicks}
                      tickFormatter={(value) => journeyLabelMap.get(value as number) || ''}
                      allowDataOverflow={true}
                    />
                    
                    
                    <YAxis 
                      yAxisId="left" 
                      stroke="#FFFFFF" 
                      strokeWidth={1}
                      fontSize={11}
                      tick={{ fill: '#FFFFFF' }}
                      label={{ 
                        value: 'Velocidad (nudos)', 
                        angle: -90, 
                        position: 'insideLeft', 
                        style: { textAnchor: 'middle', fill: '#FFFFFF', fontSize: '12px', fontWeight: '500' }
                      }}
                      domain={speedAxisConfig.domain}
                      ticks={speedAxisConfig.ticks}
                    />
                    
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      stroke="#FFFFFF" 
                      strokeWidth={1}
                      fontSize={11}
                      tick={{ fill: '#FFFFFF' }}
                      domain={stateAxisConfig.domain}
                      ticks={stateAxisConfig.ticks}
                      tickFormatter={(value) => {
                        if (value === 0) return '0.0'
                        if (value === 10) return '1.0'
                        if (value === 20) return '2.0'
                        return ''
                      }}
                    />
                    
                    {/* Línea de velocidad puntual unificada con gaps */}
                    {showSpeedLine && (
                      <Line 
                        yAxisId="left"
                        type="stepAfter" 
                        dataKey="speed" 
                        stroke="#00BFFF" 
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        activeDot={{ 
                          r: 6, 
                          fill: '#00BFFF',
                          stroke: 'none',
                          strokeWidth: 0
                        }}
                        name="speed"
                        isAnimationActive={false}
                        animationDuration={0}
                      />
                    )}

                    {/* Línea de velocidad media unificada con gaps */}
                    {showAvgSpeedLine && (
                      <Line 
                        yAxisId="left"
                        type="stepAfter" 
                        dataKey="avgSpeed" 
                        stroke="#00FFFF" 
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        activeDot={{ 
                          r: 6, 
                          fill: '#00FFFF',
                          stroke: 'none',
                          strokeWidth: 0
                        }}
                        name="avgSpeed"
                        isAnimationActive={false}
                        animationDuration={0}
                      />
                    )}
                    
                    {/* Línea de estado unificada con gaps */}
                    {showStateLine && (
                      <Line 
                        yAxisId="right"
                        type="stepAfter" 
                        dataKey="stateValueScaled" 
                        stroke="#32CD32" 
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        activeDot={{ 
                          r: 6, 
                          fill: '#32CD32',
                          stroke: 'none',
                          strokeWidth: 0
                        }}
                        name="stateValue"
                        isAnimationActive={false}
                        animationDuration={0}
                      />
                    )}

                    {/* Líneas verticales para cambios de trayecto e intervalo */}
                    {visibleChangePoints.map((change, index) => (
                      <ReferenceLine 
                        key={`${change.type}-${index}`}
                        x={change.timestamp} 
                        yAxisId="left"
                        stroke={change.type === 'journey' ? '#FF6B6B' : '#FFA500'} 
                        strokeWidth={2} 
                        strokeOpacity={0.8}
                        strokeDasharray={change.type === 'journey' ? '5 5' : '3 3'}
                      />
                    ))}

                  </LineChart>
                </ResponsiveContainer>
                </div>
                
                {/* Etiqueta del eje X */}
                <div className="flex justify-center -mt-8">
                  <span className="text-white text-xs font-normal">Hora (HH:MM)</span>
                </div>
                  
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2">Sin datos de velocidad</h4>
                    <p style={{ color: '#9CA3AF' }}>Selecciona trayectos para ver el análisis</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Paneles de estadísticas */}
          <div className="grid grid-cols-4 gap-3 h-20 mt-4 mb-4">
            {/* Panel 1: Información (4 métricas en 2x2) */}
            <div className="rounded-xl py-2 px-3 flex flex-col justify-between" style={{ backgroundColor: '#2D3748' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                <h4 className="text-blue-100 font-semibold text-xs">Información</h4>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-center">
                {/* Columna 1: Velocidad y Trayecto */}
                <div className="space-y-1">
                  <div className="text-blue-50 text-sm">
                    {(() => {
                      const p = selectedDataPoint || speedData[0]
                      if (p?.classificationType === 'GAP' || p?.speed == null) return '--.-- nudos'
                      return `${p.speed.toFixed(2)} nudos`
                    })()}
                  </div>
                  <div className="text-blue-50 text-sm">
                    {(() => {
                      const p = selectedDataPoint || speedData[0]
                      if (!p || p.journeyIndex === -1 || p.classificationType === 'GAP') return '--'
                      return `Trayecto ${p.journeyIndex}`
                    })()}
                  </div>
                </div>
                {/* Columna 2: Hora/Fecha e Intervalo */}
                <div className="space-y-1">
                  <div className="text-blue-50 text-sm">
                    {(() => {
                      const p = selectedDataPoint || speedData[0]
                      if (p?.classificationType === 'GAP' || !p?.timestamp) return '--/--/---- - --:--h'
                      const t = new Date(p.timestamp)
                      const time = t.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'h'
                      const date = t.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      return `${date} - ${time}`
                    })()}
                  </div>
                  <div className="text-blue-50 text-sm">
                    {(() => {
                      const p = selectedDataPoint || speedData[0]
                      if (!p || p.intervalNumber === -1 || p.classificationType === 'GAP') return '--'
                      return `Intervalo ${p.intervalNumber}`
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 2: Velocidad Media del Intervalo */}
            <div className="rounded-xl py-2 px-3 flex flex-col justify-between" style={{ backgroundColor: '#2D3748' }}>
              <div className="flex items-center gap-2 mb-1">
                 <div className="w-2 h-2 bg-cyan-300 rounded-full"></div>
                 <h4 className="text-cyan-100 font-semibold text-xs">
                   Velocidad Media - Intervalo {((selectedDataPoint || speedData[0])?.intervalNumber || '0')}
                 </h4>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <p className="text-cyan-50 text-base text-center">
                  {(() => {
                    const dataPoint = selectedDataPoint || speedData[0]
                    if (dataPoint?.classificationType === 'GAP' || dataPoint?.avgSpeed === null) {
                      return '--.--'
                    }
                    return dataPoint?.avgSpeed?.toFixed(2) || '--.--'
                  })()} nudos
                </p>
              </div>
            </div>

            {/* Panel 3: Tiempo del Intervalo */}
            <div className="rounded-xl py-2 px-3" style={{ backgroundColor: '#2D3748' }}>
              <div className="flex items-center gap-2 mb-1">
                 <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                 <h4 className="text-blue-100 font-semibold text-xs">
                   Duración - Intervalo {((selectedDataPoint || speedData[0])?.intervalNumber || '0')}
                 </h4>
              </div>
              <div className="space-y-0.5 text-center">
                <p className="text-blue-50 text-sm">
                  {(() => {
                    const dataPoint = selectedDataPoint || speedData[0]
                    if (dataPoint?.classificationType === 'GAP' || dataPoint?.startTime === 'GAP') {
                      return '--.--'
                    }
                    if (dataPoint?.startTime && dataPoint?.endTime) {
                      const start = new Date(dataPoint.startTime)
                      const end = new Date(dataPoint.endTime)
                      const durationMs = end.getTime() - start.getTime()
                      const days = Math.floor(durationMs / (24 * 1000 * 60 * 60))
                      const hours = Math.floor((durationMs % (24 * 1000 * 60 * 60)) / (1000 * 60 * 60))
                      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
                      if (days > 0) {
                        return `${days}d ${hours}h ${minutes}m`
                      } else if (hours > 0) {
                        return `${hours}h ${minutes}m`
                      } else {
                        return `${minutes}m`
                      }
                    }
                    return '--.--'
                  })()}
                </p>
                <p className="text-blue-100 text-xs">
                  {(() => {
                    const dataPoint = selectedDataPoint || speedData[0]
                    if (dataPoint?.classificationType === 'GAP' || dataPoint?.startTime === 'GAP') {
                      return '--.-- → --.--'
                    }
                    if (dataPoint?.startTime && dataPoint?.endTime) {
                      const start = new Date(dataPoint.startTime)
                      const end = new Date(dataPoint.endTime)
                      const startTime = start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
                      const endTime = end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
                      return `${startTime}h → ${endTime}h`
                    }
                    return '--.-- → --.--'
                  })()}
                </p>
              </div>
            </div>

            {/* Panel 4: Actividad */}
            <div className="rounded-xl py-2 px-3 flex flex-col justify-between" style={{ backgroundColor: '#2D3748' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-emerald-300 rounded-full"></div>
                 <h4 className="text-emerald-100 font-semibold text-xs">
                   Actividad del Barco - Intervalo {((selectedDataPoint || speedData[0])?.intervalNumber || '0')}
                 </h4>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <p className="text-emerald-50 text-base text-center">
                   {(() => {
                     const dataPoint = selectedDataPoint || speedData[0]
                     if (dataPoint?.classificationType === 'GAP') {
                       return '--.--'
                     }
                     return dataPoint?.classificationType || '--.--'
                   })()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SpeedProfile
