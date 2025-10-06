import React from "react"
import { CSVIntervalResult } from "../hooks/useCSVInterval"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush, ReferenceLine } from 'recharts'

interface IntervalStatsProps {
  csvResults: CSVIntervalResult | null
  selectedJourneys: Set<number>
  isVisible: boolean
  onClose: () => void
}

interface IntervalData {
  classificationType: string
  duration: string
  durationInSeconds: number
  journeyIndex: number
  intervalNumber: number
  startTime?: string
  endTime?: string
  avgSpeed?: number
  navStatus?: string
}

interface SpeedDataPoint {
  time: string
  timestamp: number // Timestamp real para el eje X
  fullDateTime?: string // Fecha completa para el eje superior
  speed: number
  navStatus: string
  stateValue: number // Nuevo campo para el valor numérico del estado
  classificationType: string
  intervalNumber: number
  journeyIndex: number
  duration: string
  startTime: string // Hora de comienzo del intervalo
  endTime: string // Hora de finalización del intervalo
}

// Función para convertir duración a segundos
const parseDurationToSeconds = (duration: string): number => {
  try {
    // Formato: "1h 13m 12s" o "30m 23s" o "45s"
    const parts = duration.split(' ')
    let totalSeconds = 0
    
    parts.forEach(part => {
      if (part.includes('h')) {
        totalSeconds += parseInt(part.replace('h', '')) * 3600
      } else if (part.includes('m')) {
        totalSeconds += parseInt(part.replace('m', '')) * 60
      } else if (part.includes('s')) {
        totalSeconds += parseInt(part.replace('s', ''))
      }
    })
    
    return totalSeconds
  } catch {
    return 0
  }
}

// Función para extraer datos de intervalos
const extractIntervalData = (csvResults: CSVIntervalResult | null, selectedJourneys: Set<number>): IntervalData[] => {
  if (!csvResults?.success || !csvResults.data?.intervals || selectedJourneys.size === 0) {
    return []
  }

  const intervals = csvResults.data.intervals
  const intervalData: IntervalData[] = []

  // Filtrar solo los intervalos reales (no separadores) de los trayectos seleccionados
  intervals.forEach((item: any) => {
    if (!item.separator && 
        item.journeyIndex && 
        selectedJourneys.has(item.journeyIndex) &&
        item.classificationType &&
        item.duration) {
      
      intervalData.push({
        classificationType: item.classificationType,
        duration: item.duration,
        durationInSeconds: parseDurationToSeconds(item.duration),
        journeyIndex: item.journeyIndex,
        intervalNumber: item.intervalNumber,
        startTime: item.startTime,
        endTime: item.endTime,
        avgSpeed: item.avgSpeed,
        navStatus: item.navStatus
      })
    }
  })

  return intervalData
}

// Función para preparar datos del gráfico de velocidad y estado
const prepareSpeedData = (intervalData: IntervalData[]): SpeedDataPoint[] => {
  // Ordenar por tiempo de inicio
  const sortedData = intervalData.sort((a, b) => {
    const timeA = new Date(a.startTime || 0).getTime()
    const timeB = new Date(b.startTime || 0).getTime()
    return timeA - timeB
  })

  const speedDataPoints: SpeedDataPoint[] = []

  sortedData.forEach((interval) => {
    const startTime = new Date(interval.startTime || 0)
    const endTime = new Date(interval.endTime || 0)
    const avgSpeed = interval.avgSpeed || 0
    const navStatusValue = parseFloat(interval.navStatus || '0.0') // Convertir a número

    // Crear solo punto de inicio y fin para cada intervalo
    const startTimeStr = startTime.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    })
    const endTimeStr = endTime.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    })
    
    // Punto de inicio del intervalo
    speedDataPoints.push({
      time: startTimeStr,
      timestamp: startTime.getTime(),
      fullDateTime: startTime.toISOString(),
      speed: avgSpeed,
      navStatus: interval.navStatus || '0.0',
      stateValue: navStatusValue,
      classificationType: interval.classificationType,
      intervalNumber: interval.intervalNumber,
      journeyIndex: interval.journeyIndex,
      duration: interval.duration,
      startTime: startTimeStr,
      endTime: endTimeStr
    })
    
    // Punto de fin del intervalo
    speedDataPoints.push({
      time: endTimeStr,
      timestamp: endTime.getTime(),
      fullDateTime: endTime.toISOString(),
      speed: avgSpeed,
      navStatus: interval.navStatus || '0.0',
      stateValue: navStatusValue,
      classificationType: interval.classificationType,
      intervalNumber: interval.intervalNumber,
      journeyIndex: interval.journeyIndex,
      duration: interval.duration,
      startTime: startTimeStr,
      endTime: endTimeStr
    })
  })

  return speedDataPoints
}

// Función para agrupar por tipo de clasificación
const groupByClassification = (intervalData: IntervalData[]) => {
  const grouped = new Map<string, { totalSeconds: number, count: number, intervals: IntervalData[] }>()
  
  intervalData.forEach(interval => {
    const key = interval.classificationType
    if (!grouped.has(key)) {
      grouped.set(key, { totalSeconds: 0, count: 0, intervals: [] })
    }
    
    const group = grouped.get(key)!
    group.totalSeconds += interval.durationInSeconds
    group.count += 1
    group.intervals.push(interval)
  })
  
  return grouped
}

// Función para formatear duración
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

// Colores para el gráfico de tartas
const CHART_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
]

// Componente PieChart
interface PieChartProps {
  data: Array<[string, { totalSeconds: number, count: number, intervals: IntervalData[] }]>
  totalSeconds: number
  highlightedIndex?: number | null
}

const PieChart: React.FC<PieChartProps> = ({ data, totalSeconds, highlightedIndex }) => {
  const size = 280
  const radius = size / 2 - 15
  const centerX = size / 2
  const centerY = size / 2
  
  let currentAngle = 0
  
  const paths = data.map(([classificationType, groupData], index) => {
    const percentage = groupData.totalSeconds / totalSeconds
    const angle = percentage * 360
    const color = CHART_COLORS[index % CHART_COLORS.length]
    const isHighlighted = highlightedIndex === index
    
    // Calcular las coordenadas del arco
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    
    const startAngleRad = (startAngle * Math.PI) / 180
    const endAngleRad = (endAngle * Math.PI) / 180
    
    // Si está resaltado, aumentar ligeramente el radio
    const currentRadius = isHighlighted ? radius + 5 : radius
    
    const x1 = centerX + currentRadius * Math.cos(startAngleRad)
    const y1 = centerY + currentRadius * Math.sin(startAngleRad)
    const x2 = centerX + currentRadius * Math.cos(endAngleRad)
    const y2 = centerY + currentRadius * Math.sin(endAngleRad)
    
    const largeArcFlag = angle > 180 ? 1 : 0
    
    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${currentRadius} ${currentRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ')
    
    currentAngle += angle
    
    return (
      <path
        key={classificationType}
        d={pathData}
        fill={color}
        stroke={isHighlighted ? "#FFFFFF" : "#374151"}
        strokeWidth={isHighlighted ? "2" : "0.5"}
        opacity={isHighlighted ? 1 : (highlightedIndex !== null ? 0.6 : 1)}
        style={{ transition: 'all 0.2s ease' }}
      >
        <title>{`${classificationType}: ${((percentage * 100).toFixed(1))}%`}</title>
      </path>
    )
  })
  
  return (
    <svg width={size} height={size} className="drop-shadow-sm">
      {paths}
    </svg>
  )
}

export default function IntervalStats({ csvResults, selectedJourneys, isVisible, onClose }: IntervalStatsProps) {
  // Todos los hooks deben declararse al principio, antes de cualquier return condicional
  const [selectedInterval, setSelectedInterval] = React.useState<IntervalData | null>(null)
  const [showSpeedLine, setShowSpeedLine] = React.useState(true)
  const [showStateLine, setShowStateLine] = React.useState(true)
  const [brushRange, setBrushRange] = React.useState<[number, number] | null>(null)
  const [isBrushMoving, setIsBrushMoving] = React.useState(false)
  const [highlightedSector, setHighlightedSector] = React.useState<number | null>(null)
  
  // Debounce para el cambio del brush
  const brushChangeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Función optimizada para el cambio del brush con movimiento libre (anti-parpadeo)
  const handleBrushChange = React.useCallback((range: any) => {
    if (range && range.startIndex !== undefined && range.endIndex !== undefined) {
      setIsBrushMoving(true)
      
      // Cancelar el timeout anterior si existe
      if (brushChangeTimeoutRef.current) {
        clearTimeout(brushChangeTimeoutRef.current)
      }
      
      // Actualizar el rango inmediatamente para el feedback visual
      setBrushRange([range.startIndex, range.endIndex])
      
      // Debounce la actualización del estado de movimiento (aumentado para evitar parpadeos)
      brushChangeTimeoutRef.current = setTimeout(() => {
        setIsBrushMoving(false)
      }, 150) // Aumentado a 150ms para evitar parpadeos durante zoom
    }
  }, [])

  // Cleanup del timeout al desmontar
  React.useEffect(() => {
    return () => {
      if (brushChangeTimeoutRef.current) {
        clearTimeout(brushChangeTimeoutRef.current)
      }
    }
  }, [])

  // Hacer el brush responsivo al cambio de tamaño de ventana (optimizado para evitar parpadeos)
  React.useEffect(() => {
    let resizeTimeout: NodeJS.Timeout | null = null
    
    const handleResize = () => {
      // Debounce el resize para evitar parpadeos
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      
      resizeTimeout = setTimeout(() => {
        // Solo re-renderizar si realmente hay un brush activo
        if (brushRange && brushRange[0] !== brushRange[1]) {
          setBrushRange([...brushRange])
        }
      }, 100) // 100ms de debounce
    }

    // Usar ResizeObserver para detectar cambios de tamaño más precisos
    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })

    // Observar el contenedor del brush si existe
    const brushContainer = document.querySelector('.brush-container')
    if (brushContainer) {
      resizeObserver.observe(brushContainer)
    }

    window.addEventListener('resize', handleResize)
    
    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
    }
  }, [brushRange])

  // Procesar datos
  const intervalData = extractIntervalData(csvResults, selectedJourneys)
  const groupedData = groupByClassification(intervalData)

  // Preparar datos para el gráfico de velocidad y estado
  const speedData = prepareSpeedData(intervalData)

  // Filtrar datos según el rango de zoom (memoizado para mejor rendimiento y anti-parpadeo)
  const zoomedData = React.useMemo(() => {
    if (!brushRange || isBrushMoving) return speedData
    return speedData.slice(brushRange[0], brushRange[1] + 1)
  }, [speedData, brushRange, isBrushMoving])
  
  if (!isVisible) {
    return null
  }

  // Validar que hay datos
  if (!intervalData || intervalData.length === 0) {
    return (
      <div 
        className="fixed inset-0 z-[999999] flex items-center justify-center bg-black bg-opacity-80 stats-modal" 
      >
        <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-md w-full mx-4 p-6">
          <div className="text-center">
            <h4 className="text-white font-medium text-xl mb-4">Estadísticas por trayectos</h4>
            <p className="text-gray-300">Selecciona uno o varios trayectos para ver las estadísticas de estos.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  if (intervalData.length === 0) {
    return (
      <div 
        className="fixed inset-0 z-[999999] flex items-center justify-center bg-black bg-opacity-80 stats-modal" 
        style={{ zIndex: 999999 }}
      >
        <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-2xl w-full mx-4" style={{ backgroundColor: '#1F2937', zIndex: 999999 }}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium text-lg">Estadísticas de Intervalos</h4>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-center text-gray-400 py-8">
              <p className="text-sm">Selecciona trayectos para ver estadísticas</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalSeconds = intervalData.reduce((sum, interval) => sum + interval.durationInSeconds, 0)
  const sortedGroups = Array.from(groupedData.entries())
    .sort((a, b) => b[1].totalSeconds - a[1].totalSeconds)

  return (
    <div 
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black bg-opacity-80 stats-modal" 
      style={{ zIndex: 999999 }}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-[95vw] max-w-none mx-2 max-h-[95vh] overflow-y-auto" 
        style={{ 
          backgroundColor: '#1F2937', 
          zIndex: 999999,
          scrollbarWidth: 'thin',
          scrollbarColor: '#6B7280 transparent'
        }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-white font-medium text-xl">Estadísticas por trayectos</h4>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Gráfico de perfil de velocidad y estado */}
          <div className="mb-6">
            <div className="bg-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">Perfil de Velocidad</h3>
              
              {/* Brush personalizado para navegación libre */}
              {speedData.length > 20 && (
                <div className="mb-4 h-16">
                  <div className="brush-container relative w-full h-full bg-gray-800 rounded select-none">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={speedData}>
                        <XAxis 
                          dataKey="timestamp" 
                          type="number"
                          scale="linear"
                          tick={{ fill: '#9CA3AF', fontSize: 10, style: { userSelect: 'none' } }}
                          axisLine={{ stroke: '#374151' }}
                          tickFormatter={(value) => {
                            // Convertir timestamp a formato HH:MM
                            const date = new Date(value)
                            return date.toLocaleTimeString('es-ES', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: false 
                            })
                          }}
                        />
                        <YAxis hide />
                        <Tooltip content={() => null} />
                        {showSpeedLine && (
                          <Line 
                            type="monotone" 
                            dataKey="speed" 
                            stroke="#3B82F6" 
                            strokeWidth={1}
                            dot={false}
                            activeDot={false}
                            name="Velocidad"
                            isAnimationActive={false}
                          />
                        )}
                        {showStateLine && (
                          <Line 
                            type="monotone" 
                            dataKey="stateValue" 
                            stroke="#10B981" 
                            strokeWidth={1}
                            dot={false}
                            activeDot={false}
                            name="Estado"
                            isAnimationActive={false}
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                    
                    {/* Brush personalizado libre */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none select-none">
                      <div 
                        className="absolute top-1 h-[calc(100%-8px)] bg-blue-500 bg-opacity-30 border border-blue-400 cursor-move pointer-events-auto select-none transition-none"
                        style={{ 
                          left: brushRange && speedData.length > 1 ? `${(brushRange[0] / (speedData.length - 1)) * 100}%` : '0%',
                          width: brushRange && speedData.length > 1 ? `${((brushRange[1] - brushRange[0]) / (speedData.length - 1)) * 100}%` : '100%',
                          willChange: isBrushMoving ? 'left, width' : 'auto'
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          const startX = e.clientX
                          const container = e.currentTarget.parentElement
                          if (!container) return
                          
                          const getContainerRect = () => container.getBoundingClientRect()
                          const containerRect = getContainerRect()
                          const containerWidth = containerRect.width
                          const startPercent = brushRange && speedData.length > 1 ? (brushRange[0] / (speedData.length - 1)) * 100 : 0
                          const widthPercent = brushRange && speedData.length > 1 ? ((brushRange[1] - brushRange[0]) / (speedData.length - 1)) * 100 : 100
                          
                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            // Recalcular el ancho del contenedor en cada movimiento para ser responsivo
                            const currentContainerRect = getContainerRect()
                            const currentContainerWidth = currentContainerRect.width
                            
                            const deltaX = moveEvent.clientX - startX
                            const deltaPercent = (deltaX / currentContainerWidth) * 100
                            const newStartPercent = Math.max(0, Math.min(100 - widthPercent, startPercent + deltaPercent))
                            const newEndPercent = newStartPercent + widthPercent
                            
                            const newStartIndex = speedData.length > 1 ? Math.round((newStartPercent / 100) * (speedData.length - 1)) : 0
                            const newEndIndex = speedData.length > 1 ? Math.round((newEndPercent / 100) * (speedData.length - 1)) : speedData.length - 1
                            
                            // Validar que los índices sean válidos
                            const validStartIndex = Math.max(0, Math.min(speedData.length - 1, newStartIndex))
                            const validEndIndex = Math.max(validStartIndex, Math.min(speedData.length - 1, newEndIndex))
                            setBrushRange([validStartIndex, validEndIndex])
                          }
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove)
                            document.removeEventListener('mouseup', handleMouseUp)
                          }
                          
                          document.addEventListener('mousemove', handleMouseMove)
                          document.addEventListener('mouseup', handleMouseUp)
                        }}
                      >
                        {/* Handles para redimensionar */}
                        <div 
                          className="absolute left-0 top-1 w-2 h-[calc(100%-8px)] bg-blue-400 cursor-ew-resize hover:bg-blue-300 select-none transition-none"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            const startX = e.clientX
                            const container = e.currentTarget.parentElement?.parentElement
                            if (!container) return
                            
                            const getContainerRect = () => container.getBoundingClientRect()
                            const containerRect = getContainerRect()
                            const containerWidth = containerRect.width
                            
                            // Mantener el extremo derecho fijo, solo mover el izquierdo
                            const currentStartPercent = brushRange && speedData.length > 1 ? (brushRange[0] / (speedData.length - 1)) * 100 : 0
                            const currentEndPercent = brushRange && speedData.length > 1 ? (brushRange[1] / (speedData.length - 1)) * 100 : 100
                            
                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              // Recalcular el ancho del contenedor en cada movimiento para ser responsivo
                              const currentContainerRect = getContainerRect()
                              const currentContainerWidth = currentContainerRect.width
                              
                              const deltaX = moveEvent.clientX - startX
                              const deltaPercent = (deltaX / currentContainerWidth) * 100
                              
                              // Solo cambiar el inicio, mantener el final fijo
                              const newStartPercent = Math.max(0, Math.min(currentEndPercent - 5, currentStartPercent + deltaPercent))
                              
                              const newStartIndex = speedData.length > 1 ? Math.round((newStartPercent / 100) * (speedData.length - 1)) : 0
                              const newEndIndex = speedData.length > 1 ? Math.round((currentEndPercent / 100) * (speedData.length - 1)) : speedData.length - 1
                              
                              // Validar que los índices sean válidos
                            const validStartIndex = Math.max(0, Math.min(speedData.length - 1, newStartIndex))
                            const validEndIndex = Math.max(validStartIndex, Math.min(speedData.length - 1, newEndIndex))
                            setBrushRange([validStartIndex, validEndIndex])
                            }
                            
                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove)
                              document.removeEventListener('mouseup', handleMouseUp)
                            }
                            
                            document.addEventListener('mousemove', handleMouseMove)
                            document.addEventListener('mouseup', handleMouseUp)
                          }}
                        />
                        <div 
                          className="absolute right-0 top-1 w-2 h-[calc(100%-8px)] bg-blue-400 cursor-ew-resize hover:bg-blue-300 select-none transition-none"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            const startX = e.clientX
                            const container = e.currentTarget.parentElement?.parentElement
                            if (!container) return
                            
                            const getContainerRect = () => container.getBoundingClientRect()
                            const containerRect = getContainerRect()
                            const containerWidth = containerRect.width
                            
                            // Mantener el extremo izquierdo fijo, solo mover el derecho
                            const currentStartPercent = brushRange && speedData.length > 1 ? (brushRange[0] / (speedData.length - 1)) * 100 : 0
                            const currentEndPercent = brushRange && speedData.length > 1 ? (brushRange[1] / (speedData.length - 1)) * 100 : 100
                            
                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              // Recalcular el ancho del contenedor en cada movimiento para ser responsivo
                              const currentContainerRect = getContainerRect()
                              const currentContainerWidth = currentContainerRect.width
                              
                              const deltaX = moveEvent.clientX - startX
                              const deltaPercent = (deltaX / currentContainerWidth) * 100
                              
                              // Solo cambiar el final, mantener el inicio fijo
                              const newEndPercent = Math.max(currentStartPercent + 5, Math.min(100, currentEndPercent + deltaPercent))
                              
                              const newStartIndex = speedData.length > 1 ? Math.round((currentStartPercent / 100) * (speedData.length - 1)) : 0
                              const newEndIndex = speedData.length > 1 ? Math.round((newEndPercent / 100) * (speedData.length - 1)) : speedData.length - 1
                              
                              // Validar que los índices sean válidos
                            const validStartIndex = Math.max(0, Math.min(speedData.length - 1, newStartIndex))
                            const validEndIndex = Math.max(validStartIndex, Math.min(speedData.length - 1, newEndIndex))
                            setBrushRange([validStartIndex, validEndIndex])
                            }
                            
                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove)
                              document.removeEventListener('mouseup', handleMouseUp)
                            }
                            
                            document.addEventListener('mousemove', handleMouseMove)
                            document.addEventListener('mouseup', handleMouseUp)
                          }}
                    />
          </div>
                </div>
                    </div>
                  </div>
              )}

              {/* Controles de visibilidad arriba del gráfico */}
              <div className="flex justify-end -mb-2">
                <div className="bg-gray-700 bg-opacity-90 rounded-lg p-2 backdrop-blur-sm">
                  <div className="flex gap-6">
                <button
                      className={`flex items-center gap-2 px-3 py-1 rounded transition-colors select-none ${
                        showSpeedLine 
                          ? 'text-blue-400 hover:text-blue-300' 
                          : 'text-gray-400 hover:text-blue-400'
                      }`}
                      onClick={() => setShowSpeedLine(!showSpeedLine)}
                    >
                      <div className={`w-3 h-3 rounded-full transition-colors ${
                        showSpeedLine ? 'bg-blue-500' : 'bg-gray-500'
                      }`}></div>
                      Velocidad
                </button>
                <button
                      className={`flex items-center gap-2 px-3 py-1 rounded transition-colors select-none ${
                        showStateLine 
                          ? 'text-green-400 hover:text-green-300' 
                          : 'text-gray-400 hover:text-green-400'
                      }`}
                      onClick={() => setShowStateLine(!showStateLine)}
                    >
                      <div className={`w-3 h-3 rounded-full transition-colors ${
                        showStateLine ? 'bg-green-500' : 'bg-gray-500'
                      }`}></div>
                      Estado
                </button>
                  </div>
                </div>
              </div>
              
              <div className="h-[500px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={zoomedData}
                    margin={{
                      top: 30,
                      right: 20,
                      left: 10,
                      bottom: 15,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    
                    {/* Eje superior para días */}
                    <XAxis 
                      xAxisId="top"
                      dataKey="timestamp" 
                      type="number"
                      scale="linear"
                      orientation="top"
                      stroke="#9CA3AF"
                      fontSize={9}
                      tick={{ fill: '#9CA3AF' }}
                      tickCount={12}
                      height={20}
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(value) => {
                        try {
                          const date = new Date(value)
                          return date.toLocaleDateString('es-ES', { 
                            day: '2-digit',
                            month: '2-digit'
                          })
                        } catch (error) {
                          return ''
                        }
                      }}
                    />
                    
                    <XAxis 
                      dataKey="timestamp" 
                      type="number"
                      scale="linear"
                      stroke="#9CA3AF"
                      fontSize={10}
                      tick={{ fill: '#9CA3AF' }}
                      domain={['dataMin', 'dataMax']}
                      tickCount={12}
                      tickFormatter={(value) => {
                        // Convertir timestamp a formato HH:MM
                        const date = new Date(value)
                        return date.toLocaleTimeString('es-ES', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            hour12: false 
                        })
                      }}
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke="#3B82F6"
                      fontSize={11}
                      tick={{ fill: '#3B82F6' }}
                      domain={[0, 'dataMax + 1']}
                      ticks={[0, 2, 4, 6, 8, 10, 12, 14, 16]}
                      label={{ 
                        value: 'Velocidad (nudos)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: '#3B82F6', fontSize: '12px' }
                      }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke="#10B981"
                      fontSize={11}
                      tick={{ fill: '#10B981' }}
                      domain={[0, 2]}
                      ticks={[0, 1, 2]}
                      label={{ 
                        value: 'Estado', 
                        angle: 90, 
                        position: 'insideRight',
                        style: { textAnchor: 'middle', fill: '#10B981', fontSize: '12px' }
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(31, 41, 55, 0.7)',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        backdropFilter: 'blur(4px)'
                      }}
                      labelStyle={{ color: '#E5E7EB' }}
                      formatter={() => {
                        // No mostrar valores duplicados en el formatter
                        // Los datos de velocidad y estado ya se muestran en labelFormatter
                        return [null, null]
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          const data = payload[0].payload as SpeedDataPoint
                          
                          // Extraer fecha para mostrar el día
                          let diaInfo = ''
                          if (data.fullDateTime) {
                            const fecha = new Date(data.fullDateTime)
                            diaInfo = fecha.toLocaleDateString('es-ES', { 
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                            })
                          }
                          
                          return (
                            <div className="text-white space-y-1">
                              {/* Datos de los ejes (prioridad) */}
                              <div className="border-b border-gray-600 pb-2 mb-2">
                                <div className="text-blue-400 font-medium">Velocidad: {data.speed.toFixed(2)} nudos</div>
                                <div className="text-green-400 font-medium">Estado: {data.stateValue}</div>
                                <div>Hora: {data.time}</div>
                                {diaInfo && <div>Día: {diaInfo}</div>}
                    </div>
                              
                              {/* Datos del intervalo */}
                              <div className="text-sm">
                                <div className="flex gap-4">
                                  <span><span className="text-white">Trayecto:</span> <span className="text-gray-300">{data.journeyIndex}</span></span>
                                  <span><span className="text-white">Intervalo:</span> <span className="text-gray-300">{data.intervalNumber}</span></span>
                  </div>
                                <div><span className="text-white">Actividad:</span> <span className="text-gray-300">{data.classificationType}</span></div>
                                <div className="mt-2">
                                  <div><span className="text-white">Hora de comienzo:</span> <span className="text-gray-300">{data.startTime}</span></div>
                                  <div><span className="text-white">Hora de finalización:</span> <span className="text-gray-300">{data.endTime}</span></div>
                                  <div><span className="text-white">Duración:</span> <span className="text-gray-300">{data.duration}</span></div>
                </div>
                              </div>
                </div>
                          )
                        }
                        return label
                      }}
                    />
                    {showSpeedLine && (
                      <Line 
                        yAxisId="left"
                        type="stepAfter" 
                        dataKey="speed" 
                        stroke="#3B82F6" 
                        strokeWidth={3}
                        dot={false}
                        activeDot={false}
                        name="Velocidad"
                        isAnimationActive={false}
                      />
                    )}
                    {showStateLine && (
                      <Line 
                        yAxisId="right"
                        type="stepAfter" 
                        dataKey="stateValue" 
                        stroke="#10B981" 
                        strokeWidth={3}
                        dot={false}
                        activeDot={false}
                        name="Estado"
                        isAnimationActive={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Gráfico de quesos (pie chart) */}
          <div className="mb-6">
            <div className="text-xl font-medium text-white mb-6">
              Distribución por sectores
              <span className="text-sm text-gray-400 ml-2">
                ({selectedJourneys.size} trayecto{selectedJourneys.size > 1 ? 's' : ''} analizado{selectedJourneys.size > 1 ? 's' : ''})
              </span>
            </div>
            <div className="flex flex-col items-center gap-8">
              <div className="flex justify-center">
                <PieChart data={sortedGroups} totalSeconds={totalSeconds} highlightedIndex={highlightedSector} />
              </div>
              <div className="w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedGroups.map(([classificationType, data], index) => {
                    const percentage = ((data.totalSeconds / totalSeconds) * 100).toFixed(1)
                    const color = CHART_COLORS[index % CHART_COLORS.length]
                    
                    return (
                      <div 
                        key={classificationType} 
                        className="flex items-start gap-3 bg-gray-700 rounded-lg p-3 min-h-[80px] cursor-pointer transition-all duration-200 hover:bg-gray-600"
                        onMouseEnter={() => setHighlightedSector(index)}
                        onMouseLeave={() => setHighlightedSector(null)}
                      >
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0 mt-1 transition-all duration-200"
                          style={{ 
                            backgroundColor: color,
                            transform: highlightedSector === index ? 'scale(1.2)' : 'scale(1)',
                            boxShadow: highlightedSector === index ? `0 0 8px ${color}` : 'none'
                          }}
                        />
                        <div className="flex-1 text-gray-300 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <span 
                              className="font-medium text-sm leading-tight truncate pr-2 transition-colors duration-200" 
                              style={{ color: highlightedSector === index ? '#FFFFFF' : undefined }}
                              title={classificationType}
                            >
                              {classificationType}
                            </span>
                            <span className="text-gray-400 flex-shrink-0 text-sm font-semibold">
                              {percentage}%
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 leading-tight">
                            {formatDuration(data.totalSeconds)}
                          </div>
                          <div className="text-xs text-gray-400 leading-tight">
                            ({data.count} intervalo{data.count > 1 ? 's' : ''})
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}