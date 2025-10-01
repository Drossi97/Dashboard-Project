import React, { useState, useMemo } from "react"
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { CSVAnalysisResult } from "../hooks/useCSVProcessor"

interface LineChartProps {
  results: CSVAnalysisResult | null
  onIntervalClick?: (intervalIndex: number) => void
  selectedIntervals?: number[]
}

interface IntervalClassification {
  type: "docked" | "maneuvering" | "transit" | "undefined"
  description: string
  fromPort?: string
  toPort?: string
  atPort?: string
}

interface ChartDataPoint {
  time: string
  date: string
  timestamp: number
  speed: number | null
  navStatus: string
  navStatusValue: number | null
  classification?: IntervalClassification
  isGap?: boolean
  intervalStartTime?: string
  intervalEndTime?: string
  intervalStartDate?: string
  intervalEndDate?: string
  duration?: string
  isStartPoint?: boolean
  isCenterPoint?: boolean
  isEndPoint?: boolean
}

export function LineChart({ results, onIntervalClick, selectedIntervals = [] }: LineChartProps) {
  const [showHelp, setShowHelp] = React.useState(false)
  const [visibleLines, setVisibleLines] = useState({
    speed: true,
    navStatus: true
  })
  const [zoomDomain, setZoomDomain] = useState<{startIndex: number, endIndex: number} | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null)
  const [hoveredData, setHoveredData] = useState<ChartDataPoint | null>(null)

  // Función auxiliar para extraer información del classificationType
  const parseClassificationType = (classificationType?: string): IntervalClassification => {
    if (!classificationType) {
      return { type: 'undefined', description: 'No classification available' }
    }

    if (classificationType.startsWith('atracado - ')) {
      const port = classificationType.replace('atracado - ', '')
      return { 
        type: 'docked', 
        description: `docked at ${port}`,
        atPort: port
      }
    }

    if (classificationType.startsWith('maniobrando - ')) {
      const port = classificationType.replace('maniobrando - ', '')
      return { 
        type: 'maneuvering', 
        description: `maneuvering at ${port}`,
        atPort: port
      }
    }

    if (classificationType.startsWith('navegando - ')) {
      const rest = classificationType.replace('navegando - ', '')
      if (rest.includes(' → ')) {
        const [from, to] = rest.split(' → ')
        return { 
          type: 'transit', 
          description: `in transit from ${from} to ${to}`,
          fromPort: from,
          toPort: to
        }
      } else if (rest.startsWith('cerca de ')) {
        const port = rest.replace('cerca de ', '')
        return { 
          type: 'transit', 
          description: `in transit near ${port}`,
          atPort: port
        }
      }
    }

    return { type: 'undefined', description: classificationType }
  };

  // Crear datos del gráfico (un punto por intervalo en el centro)
  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = []

    if (!results || !results.data?.intervals || results.data.intervals.length === 0) {
      return data
    }

    // Ordenar intervalos por timestamp
    const sortedIntervals = [...results.data.intervals].sort(
      (a, b) => new Date(`${a.startDate} ${a.startTime}`).getTime() - new Date(`${b.startDate} ${b.startTime}`).getTime()
    )

    sortedIntervals.forEach((interval, index) => {
      const startTimestamp = new Date(`${interval.startDate} ${interval.startTime}`).getTime()
      const endTimestamp = new Date(`${interval.endDate} ${interval.endTime}`).getTime()

      // Usar la clasificación que ya viene del JSON
      const classification = parseClassificationType(interval.classificationType);

      // Verificar si hay un gap con el intervalo anterior
      if (index > 0) {
        const prevInterval = sortedIntervals[index - 1]
        const prevEndTimestamp = new Date(`${prevInterval.endDate} ${prevInterval.endTime}`).getTime()
        const gapInSeconds = (startTimestamp - prevEndTimestamp) / 1000

        // Si hay un gap mayor a 0.6 segundos
        if (gapInSeconds > 0.6) {
          data.push({
            time: new Date(prevEndTimestamp).toTimeString().split(' ')[0].substring(0, 8),
            date: prevInterval.endDate,
            timestamp: prevEndTimestamp,
            speed: null,
            navStatus: 'sin datos',
            navStatusValue: null,
            isGap: true
          })
        }
      }

      // Puntos intermedios del intervalo para mejor interacción
      const intervalDuration = endTimestamp - startTimestamp

      // Punto al inicio del intervalo
      data.push({
        time: interval.startTime,
        date: interval.startDate,
        timestamp: startTimestamp,
        speed: interval.avgSpeed,
        navStatus: interval.navStatus,
        navStatusValue: parseInt(interval.navStatus) || 0,
        classification,
        intervalStartTime: interval.startTime,
        intervalEndTime: interval.endTime,
        intervalStartDate: interval.startDate,
        intervalEndDate: interval.endDate,
        duration: interval.duration,
        isStartPoint: true
      })

      // Punto en el centro del intervalo
      const centerTimestamp = startTimestamp + intervalDuration / 2
      data.push({
        time: new Date(centerTimestamp).toTimeString().split(' ')[0].substring(0, 8),
        date: interval.startDate,
        timestamp: centerTimestamp,
        speed: interval.avgSpeed,
        navStatus: interval.navStatus,
        navStatusValue: parseInt(interval.navStatus) || 0,
        classification,
        intervalStartTime: interval.startTime,
        intervalEndTime: interval.endTime,
        intervalStartDate: interval.startDate,
        intervalEndDate: interval.endDate,
        duration: interval.duration,
        isCenterPoint: true
      })

      // Punto al final del intervalo
      data.push({
        time: interval.endTime,
        date: interval.endDate,
        timestamp: endTimestamp,
        speed: interval.avgSpeed,
        navStatus: interval.navStatus,
        navStatusValue: parseInt(interval.navStatus) || 0,
        classification,
        intervalStartTime: interval.startTime,
        intervalEndTime: interval.endTime,
        intervalStartDate: interval.startDate,
        intervalEndDate: interval.endDate,
        duration: interval.duration,
        isEndPoint: true
      })
    })

    return data.sort((a, b) => a.timestamp - b.timestamp)
  }, [results, results?.data?.intervals, parseClassificationType])

  // Filtrar datos según zoom
  const visibleData = useMemo(() => {
    if (!zoomDomain) return chartData
    return chartData.slice(zoomDomain.startIndex, zoomDomain.endIndex + 1)
  }, [chartData, zoomDomain])

  // Funciones de control
  const toggleLineVisibility = (lineType: 'speed' | 'navStatus') => {
    setVisibleLines(prev => ({ ...prev, [lineType]: !prev[lineType] }))
  }

  const handleZoom = (zoomIn: boolean, mousePosition?: number) => {
    const totalLength = chartData.length

    if (zoomIn) {
      if (!zoomDomain) {
        // Primer zoom: mostrar 60% centrado en la posición del mouse
        const rangeSize = Math.floor(totalLength * 0.6)
        const centerIndex = mousePosition !== undefined ? Math.floor(totalLength * mousePosition) : Math.floor(totalLength / 2)
        const start = Math.max(0, centerIndex - Math.floor(rangeSize / 2))
        const end = Math.min(totalLength - 1, start + rangeSize)
        setZoomDomain({ startIndex: start, endIndex: end })
      } else {
        const currentRange = zoomDomain.endIndex - zoomDomain.startIndex
        const currentCenter = Math.floor((zoomDomain.startIndex + zoomDomain.endIndex) / 2)

        if (currentRange > 20) {
          // Reducir el rango actual en 25% centrado en la posición actual
          const reduction = Math.floor(currentRange * 0.25)
          const centerIndex = mousePosition !== undefined ? Math.floor(totalLength * mousePosition) : currentCenter
          const newStart = Math.max(0, centerIndex - Math.floor((currentRange - reduction) / 2))
          const newEnd = Math.min(totalLength - 1, centerIndex + Math.floor((currentRange - reduction) / 2))
          setZoomDomain({ startIndex: newStart, endIndex: newEnd })
        }
      }
    } else {
      if (!zoomDomain) return

      const currentRange = zoomDomain.endIndex - zoomDomain.startIndex
      const currentCenter = Math.floor((zoomDomain.startIndex + zoomDomain.endIndex) / 2)

      // Expandir el rango actual en 30% centrado en la posición actual
      const expansion = Math.floor(currentRange * 0.3)
      const centerIndex = mousePosition !== undefined ? Math.floor(totalLength * mousePosition) : currentCenter
      const newRange = currentRange + expansion * 2
      const newStart = Math.max(0, centerIndex - Math.floor(newRange / 2))
      const newEnd = Math.min(totalLength - 1, centerIndex + Math.floor(newRange / 2))

      if (newEnd - newStart >= totalLength * 0.9) {
        setZoomDomain(null)
      } else {
        setZoomDomain({ startIndex: newStart, endIndex: newEnd })
      }
    }
  }

  const resetZoom = () => {
    setZoomDomain(null)
  }

  // Funciones para el pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!zoomDomain) return
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !zoomDomain) return

    const deltaX = e.clientX - dragStart.x
    const chartWidth = e.currentTarget.getBoundingClientRect().width || 800
    const totalRange = chartData.length
    const currentRange = zoomDomain.endIndex - zoomDomain.startIndex

    const moveRatio = deltaX / chartWidth
    const pointsToMove = Math.round(moveRatio * currentRange * 2)

    let newStart = zoomDomain.startIndex - pointsToMove
    let newEnd = zoomDomain.endIndex - pointsToMove

    if (newStart < 0) {
      newStart = 0
      newEnd = currentRange
    }
    if (newEnd > totalRange - 1) {
      newEnd = totalRange - 1
      newStart = newEnd - currentRange
    }

    setZoomDomain({ startIndex: newStart, endIndex: newEnd })
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
  }

  // Funciones de formateo
  const formatTimeLabel = (value: string, index: number) => {
    const dataPoint = visibleData[index]
    if (!dataPoint || dataPoint.isGap) return ''
    return value.substring(0, 5) + 'h'
  }

  const formatDateLabel = (value: string, index: number) => {
    const dataPoint = visibleData[index]
    if (!dataPoint || !dataPoint.date) return value

    if (index > 0) {
      const prevDataPoint = visibleData[index - 1]
      if (prevDataPoint && prevDataPoint.date === dataPoint.date) {
        return ''
      }
    }

    const [year, month, day] = dataPoint.date.split('-')
    return `${day}-${month}`
  }

  // Calcular rangos para ejes Y
  const speedValues = visibleData.map(d => d.speed).filter(v => v !== null) as number[]
  const statusValues = visibleData.map(d => d.navStatusValue).filter(v => v !== null) as number[]

  const minSpeed = speedValues.length > 0 ? Math.min(...speedValues) : 0
  const maxSpeed = speedValues.length > 0 ? Math.max(...speedValues) : 10
  const minStatus = statusValues.length > 0 ? Math.min(...statusValues, 0) : 0
  const maxStatus = statusValues.length > 0 ? Math.max(...statusValues, 2) : 2

  // Funciones auxiliares para hover
  const formatDurationWithUnits = (duration: string | number | undefined): string => {
    if (!duration) return '--:--:--'

    if (typeof duration === 'number') {
      const seconds = duration
      if (seconds === 0) return '--:--:--'

      const days = Math.floor(seconds / (24 * 3600))
      const hours = Math.floor((seconds % (24 * 3600)) / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = Math.floor(seconds % 60)

      if (days > 0) {
        return `${days}d ${hours}h ${minutes}m ${secs}s`
      } else if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`
      } else {
        return `${secs}s`
      }
    }

    const timeToSeconds = (timeString: string): number => {
      if (!timeString || timeString === '--:--:--') return 0
      const parts = timeString.split(':').map(Number)
      if (parts.length !== 3) return 0
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }

    const seconds = timeToSeconds(duration)
    if (seconds === 0) return '--:--:--'

    const days = Math.floor(seconds / (24 * 3600))
    const hours = Math.floor((seconds % (24 * 3600)) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const formatTimeOnly = (timeString: string | undefined): string => {
    if (!timeString || timeString === '--:--:--') return '--:--:--'
    if (typeof timeString !== 'string') return String(timeString || '--:--:--')

    const parts = timeString.split(':')
    if (parts.length !== 3) return timeString
    
    const hours = parts[0].padStart(2, '0')
    const minutes = parts[1].padStart(2, '0')
    const seconds = Math.floor(parseFloat(parts[2])).toString().padStart(2, '0')
    
    return `${hours}:${minutes}:${seconds}`
  }

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString || dateString === '--') return '--'
    if (typeof dateString !== 'string') return String(dateString || '--')

    const parts = dateString.split('-')
    if (parts.length !== 3) return dateString

    const [year, month, day] = parts
    return `${day}/${month}/${year}`
  }

  const currentInterval = useMemo(() => {
    if (!hoveredData || hoveredData.isGap) return null

    if (hoveredData.intervalStartTime) {
      return {
        startTime: hoveredData.intervalStartTime,
        endTime: hoveredData.intervalEndTime,
        startDate: hoveredData.intervalStartDate,
        endDate: hoveredData.intervalEndDate,
        duration: hoveredData.duration,
        navStatus: hoveredData.navStatus,
        avgSpeed: hoveredData.speed,
        startPort: null,
        endPort: null
      }
    }

    return null
  }, [hoveredData])

  // Verificar si el intervalo actual está seleccionado
  const isCurrentIntervalSelected = useMemo(() => {
    if (!hoveredData || hoveredData.isGap || !results?.data?.intervals) return false
    
    const intervalIndex = results.data.intervals.findIndex(interval => 
      interval.startDate === hoveredData.intervalStartDate &&
      interval.startTime === hoveredData.intervalStartTime &&
      interval.endDate === hoveredData.intervalEndDate &&
      interval.endTime === hoveredData.intervalEndTime
    )
    
    return intervalIndex !== -1 && selectedIntervals.includes(intervalIndex)
  }, [hoveredData, results?.data?.intervals, selectedIntervals])

  // Early return después de todos los hooks
  if (!results || !results.success || !results.data) return null

  return (
    <Card style={{ backgroundColor: '#171717', borderColor: '#2C2C2C' }}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
        <CardTitle className="text-white text-lg font-semibold">Grafico de intervalos</CardTitle>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold hover:bg-gray-700 transition-colors duration-200"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #4B5563',
              color: '#9CA3AF'
            }}
          >
            ?
          </button>
        </div>
        
        {/* Cuadro de ayuda */}
        {showHelp && (
          <div className="mt-4 p-4 rounded-md text-sm" style={{ backgroundColor: '#2C2C2C', border: '1px solid #4B5563' }}>
            <h4 className="text-white font-semibold mb-2">ℹ️ Cómo interpretar el gráfico</h4>
            <ul className="text-gray-300 space-y-2 text-xs">
              <li><strong className="text-blue-400">Línea azul (Velocidad):</strong> Muestra la velocidad del barco en nudos (knots)</li>
              <li><strong className="text-green-400">Línea verde (Estado):</strong> Indica el estado de navegación (0.0 = Atracado, 1.0 = Maniobrando, 2.0 = Navegando)</li>
              <li><strong className="text-white">Controles de zoom:</strong> Usa 🔍+ y 🔍- para acercar/alejar, ↻ para resetear la vista</li>
              <li><strong className="text-white">Navegación:</strong> Arrastra el gráfico para moverte cuando estés en modo zoom</li>
              <li><strong className="text-cyan-400">Leyenda interactiva:</strong> Pasa el mouse sobre el gráfico para ver los detalles de cada intervalo</li>
              <li><strong className="text-white">Clic derecho:</strong> Haz clic derecho en un intervalo para seleccionarlo/deseleccionarlo</li>
              <li><strong className="text-green-400">Intervalo seleccionado:</strong> La leyenda mostrará un indicador "✓ SELECCIONADO" cuando pases el mouse sobre un intervalo ya seleccionado</li>
            </ul>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 relative">
            {/* Botones de líneas */}
            <div className="flex justify-center items-center mb-2">
              <div className="flex gap-3">
                <button
                  onClick={() => toggleLineVisibility('speed')}
                  className={`flex items-center gap-2 ${
                    visibleLines.speed
                      ? 'text-blue-400'
                      : 'text-gray-400 hover:text-blue-300'
                  }`}
                >
                  <div className={`w-4 h-0.5 ${
                    visibleLines.speed ? 'bg-blue-400' : 'bg-gray-600'
                  }`}></div>
                  Velocidad
                </button>

                <button
                  onClick={() => toggleLineVisibility('navStatus')}
                  className={`flex items-center gap-2 ${
                    visibleLines.navStatus
                      ? 'text-green-400'
                      : 'text-gray-400 hover:text-green-300'
                  }`}
                >
                  <div className={`w-4 h-0.5 ${
                    visibleLines.navStatus ? 'bg-green-400' : 'bg-gray-600'
                  }`}></div>
                  Estado
                </button>
              </div>
            </div>

            {/* Botones de zoom en esquina superior derecha */}
            <div className="absolute top-[30px] right-[30px] z-10">
              <div className="flex gap-2">
                <button
                  onClick={() => handleZoom(true)}
                  className="px-3 py-1 text-sm relative group"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: '#9CA3AF'
                  }}
                >
                  🔍+
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-60 transition-opacity duration-200"></div>
                </button>

                <button
                  onClick={() => handleZoom(false)}
                  className="px-3 py-1 text-sm relative group"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: '#9CA3AF'
                  }}
                >
                  🔍-
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-60 transition-opacity duration-200"></div>
                </button>

                <button
                  onClick={resetZoom}
                  className="px-3 py-1 text-sm relative"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: '#9CA3AF'
                  }}
                >
                  ↻
                  {zoomDomain && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-60"></div>
                  )}
                </button>
              </div>
            </div>

            <div 
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onContextMenu={(e) => {
                e.preventDefault()
                if (!hoveredData || hoveredData.isGap || !onIntervalClick || !results?.data?.intervals) return
                if (hoveredData.intervalStartDate && hoveredData.intervalStartTime) {
                  // Buscar el índice del intervalo en el array original
                  const intervalIndex = results.data.intervals.findIndex(interval => 
                    interval.startDate === hoveredData.intervalStartDate &&
                    interval.startTime === hoveredData.intervalStartTime &&
                    interval.endDate === hoveredData.intervalEndDate &&
                    interval.endTime === hoveredData.intervalEndTime
                  )
                  if (intervalIndex !== -1) {
                    onIntervalClick(intervalIndex)
                  }
                }
              }}
              style={{
                cursor: isDragging ? 'grabbing' : (zoomDomain ? 'grab' : 'crosshair'),
                userSelect: 'none'
              }}
            >
              <ResponsiveContainer width="100%" height={600}>
                  <RechartsLineChart
                    data={visibleData}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 50,
                    }}
                  onMouseMove={(data) => {
                    if (data && data.activePayload && data.activePayload.length > 0) {
                      setHoveredData(data.activePayload[0].payload)
                    }
                  }}
                  onMouseLeave={() => setHoveredData(null)}
                >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#2C2C2C"
                  opacity={0.3}
                />

                {/* Eje X superior para fechas */}
                <XAxis
                  xAxisId="dates"
                  dataKey="date"
                  orientation="top"
                  stroke="#9CA3AF"
                  fontSize={12}
                  angle={0}
                  textAnchor="middle"
                  height={40}
                  interval={0}
                  tickFormatter={formatDateLabel}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={12}
                />

                {/* Eje X inferior para horas */}
                <XAxis
                  xAxisId="times"
                  dataKey="time"
                  orientation="bottom"
                  stroke="#9CA3AF"
                  fontSize={12}
                  angle={0}
                  textAnchor="middle"
                  height={40}
                  interval={Math.floor(visibleData.length / 8)}
                  tickFormatter={formatTimeLabel}
                  tickMargin={12}
                />

                <YAxis
                  yAxisId="speed"
                  orientation="left"
                  stroke="#3B82F6"
                  fontSize={12}
                  domain={[minSpeed, maxSpeed]}
                  tickMargin={5}
                  label={{
                    value: 'Velocidad (nudos)',
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: '#3B82F6' }
                  }}
                />

                <YAxis
                  yAxisId="status"
                  orientation="right"
                  stroke="#10B981"
                  fontSize={12}
                  domain={[minStatus, maxStatus]}
                  type="number"
                  allowDecimals={false}
                  tickMargin={5}
                  tickFormatter={(value) => `${Math.round(value)}`}
                  label={{
                    value: 'Estado',
                    angle: 90,
                    position: 'insideRight',
                    style: { textAnchor: 'middle', fill: '#10B981' }
                  }}
                />

                <Tooltip
                  cursor={false}
                  content={() => null}
                />

                {visibleLines.speed && (
                  <Line
                    xAxisId="times"
                    yAxisId="speed"
                    type="stepAfter"
                    dataKey="speed"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}

                {visibleLines.navStatus && (
                  <Line
                    xAxisId="times"
                    yAxisId="status"
                    type="stepAfter"
                    dataKey="navStatusValue"
                    stroke="#10B981"
                    strokeWidth={3}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}

                {(() => {
                  const gapAreas: any[] = []
                  visibleData.forEach((dataPoint, index) => {
                    if (dataPoint.isGap && index < visibleData.length - 1) {
                      const nextDataPoint = visibleData[index + 1]
                      if (nextDataPoint && !nextDataPoint.isGap) {
                        gapAreas.push({
                          x1: dataPoint.timestamp,
                          x2: nextDataPoint.timestamp,
                          fill: 'rgba(255, 255, 255, 0.1)',
                          fillOpacity: 0.3
                        })
                      }
                    }
                  })
                  return gapAreas.map((area, index) => (
                    <ReferenceArea
                      key={`gap-${index}`}
                      x1={area.x1}
                      x2={area.x2}
                      fill={area.fill}
                      fillOpacity={area.fillOpacity}
                    />
                  ))
                })()}

                </RechartsLineChart>
              </ResponsiveContainer>
            </div>

          </div>

          <div className="lg:w-40 flex flex-col h-full">
            <div className="text-center mb-4">
              <h3 className="text-lg font-bold text-white mb-2">Leyenda</h3>
              <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
            </div>
            
            {/* Indicador de selección */}
            {isCurrentIntervalSelected && (
              <div className="mb-2 px-2 py-2 rounded-md text-center animate-pulse" style={{ backgroundColor: '#065F46', border: '2px solid #10B981' }}>
                <div className="text-xs font-bold text-white">✓ SELECCIONADO</div>
              </div>
            )}
            
            <div className="flex-1 flex flex-col justify-between pt-2 space-y-1">
              {/* 1. Estado (NavStatus) */}
              <div
                className="pl-2 pr-2 pt-1 pb-2 rounded-md border h-16 flex flex-col"
                style={{ backgroundColor: '#2C2C2C', borderColor: hoveredData && !hoveredData.isGap ? '#10B981' : '#2C2C2C' }}
              >
                <div className="text-xs text-gray-400 leading-tight">Estado</div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-lg font-bold text-green-400 text-center">
                    {hoveredData?.isGap ? 'Sin datos' : (hoveredData?.navStatus || '--')}
                  </div>
                </div>
              </div>

              {/* 2. Actividad */}
              <div
                className="pl-2 pr-2 pt-1 pb-2 rounded-md border h-16 flex flex-col"
                style={{ 
                  backgroundColor: '#2C2C2C', 
                  borderColor: hoveredData && !hoveredData.isGap && hoveredData?.classification
                    ? hoveredData.classification.type === 'docked' 
                      ? '#6B7280'
                      : hoveredData.classification.type === 'maneuvering'
                      ? '#F59E0B'
                      : hoveredData.classification.type === 'transit'
                      ? '#10B981'
                      : '#EF4444'
                    : '#2C2C2C'
                }}
              >
                <div className="text-xs text-gray-400 leading-tight">Actividad</div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-sm font-bold text-center"
                       style={{
                         color: hoveredData && !hoveredData.isGap && hoveredData?.classification
                           ? hoveredData.classification.type === 'docked' 
                             ? '#6B7280'
                             : hoveredData.classification.type === 'maneuvering'
                             ? '#F59E0B'
                             : hoveredData.classification.type === 'transit'
                             ? '#10B981'
                             : '#EF4444'
                           : '#8B5CF6'
                       }}
                  >
                    {hoveredData && !hoveredData.isGap && hoveredData?.classification ? (
                      <div>
                        <div className="text-xs text-center">
                          {hoveredData.classification.type === 'docked' && 'ATRACADO'}
                          {hoveredData.classification.type === 'maneuvering' && 'MANIOBRANDO'}
                          {hoveredData.classification.type === 'transit' && 'NAVEGANDO'}
                          {hoveredData.classification.type === 'undefined' && 'Estado indefinido'}
                        </div>
                        {hoveredData.classification.atPort && (
                          <div className="text-xs text-gray-300 mt-1 text-center">
                            en {hoveredData.classification.atPort}
                          </div>
                        )}
                        {hoveredData.classification.fromPort && hoveredData.classification.toPort && (
                          <div className="text-xs text-gray-300 mt-1 text-center">
                            {hoveredData.classification.fromPort} → {hoveredData.classification.toPort}
                          </div>
                        )}
                      </div>
                    ) : (
                      '--'
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Velocidad Media */}
              <div
                className="pl-2 pr-2 pt-1 pb-2 rounded-md border h-16 flex flex-col"
                style={{ backgroundColor: '#2C2C2C', borderColor: hoveredData && !hoveredData.isGap ? '#3B82F6' : '#2C2C2C' }}
              >
                <div className="text-xs text-gray-400 leading-tight">Velocidad Media</div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-lg font-bold text-blue-400 text-center">
                    {hoveredData && !hoveredData.isGap ? (hoveredData?.speed?.toFixed(2) || '--') : '--'}
                    <span className="text-xs font-normal ml-1">kn</span>
                  </div>
                </div>
              </div>

              {/* 4. Duración */}
              <div
                className="pl-2 pr-2 pt-1 pb-2 rounded-md border h-16 flex flex-col"
                style={{ backgroundColor: '#2C2C2C', borderColor: '#2C2C2C' }}
              >
                <div className="text-xs text-gray-400 leading-tight">Duración</div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-sm font-bold text-orange-400 font-mono text-center">
                    {currentInterval?.duration ? formatDurationWithUnits(currentInterval.duration) : '--:--:--'}
                  </div>
                </div>
              </div>

              {/* 5. Hora Inicial */}
              <div
                className="pl-2 pr-2 pt-1 pb-2 rounded-md border h-16 flex flex-col"
                style={{ backgroundColor: '#2C2C2C', borderColor: '#2C2C2C' }}
              >
                <div className="text-xs text-gray-400 leading-tight">Hora Inicial</div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-sm font-bold text-white font-mono text-center">
                    {currentInterval?.startTime ? formatTimeOnly(currentInterval.startTime) : '--:--:--'}
                  </div>
                </div>
              </div>

              {/* 6. Hora Final */}
              <div
                className="pl-2 pr-2 pt-1 pb-2 rounded-md border h-16 flex flex-col"
                style={{ backgroundColor: '#2C2C2C', borderColor: '#2C2C2C' }}
              >
                <div className="text-xs text-gray-400 leading-tight">Hora Final</div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-sm font-bold text-white font-mono text-center">
                    {currentInterval?.endTime ? formatTimeOnly(currentInterval.endTime) : '--:--:--'}
                  </div>
                </div>
              </div>

              {/* 7. Fecha */}
              <div
                className="pl-2 pr-2 pt-1 pb-2 rounded-md border h-16 flex flex-col"
                style={{ backgroundColor: '#2C2C2C', borderColor: '#2C2C2C' }}
              >
                <div className="text-xs text-gray-400 leading-tight">Fecha</div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-sm font-bold text-white text-center">
                    {hoveredData && !hoveredData.isGap ?
                      formatDate(hoveredData?.date || currentInterval?.startDate || '--') :
                      '--'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
