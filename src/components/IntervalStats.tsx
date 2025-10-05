import React from "react"
import { CSVPruebaResult } from "../hooks/useCSVprueba"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js'
import { Chart } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
)

interface IntervalStatsProps {
  csvResults: CSVPruebaResult | null
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
const extractIntervalData = (csvResults: CSVPruebaResult | null, selectedJourneys: Set<number>): IntervalData[] => {
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

// Función para preparar datos del gráfico
const prepareChartData = (intervalData: IntervalData[]) => {
  // Ordenar por tiempo de inicio
  const sortedData = intervalData.sort((a, b) => {
    const timeA = new Date(a.startTime || 0).getTime()
    const timeB = new Date(b.startTime || 0).getTime()
    return timeA - timeB
  })

  // Crear puntos para inicio y fin de cada intervalo
  const chartPoints: Array<{
    x: Date
    speed: number
    state: number
    intervalNumber: number
    duration: string
    classificationType: string
    isStart: boolean
    isEnd: boolean
  }> = []

  sortedData.forEach((interval, index) => {
    const startTime = new Date(interval.startTime || 0)
    const endTime = new Date(interval.endTime || 0)

    const navStatus = parseFloat(interval.navStatus || '0.0')

    // Punto de inicio del intervalo
    chartPoints.push({
      x: startTime,
      speed: interval.avgSpeed || 0,
      state: navStatus,
      intervalNumber: interval.intervalNumber || index + 1,
      duration: interval.duration || '0s',
      classificationType: interval.classificationType || 'Desconocido',
      isStart: true,
      isEnd: false
    })

    // Punto de fin del intervalo (solo si es diferente al inicio)
    if (startTime.getTime() !== endTime.getTime()) {
      chartPoints.push({
        x: endTime,
        speed: interval.avgSpeed || 0,
        state: navStatus,
        intervalNumber: interval.intervalNumber || index + 1,
        duration: interval.duration || '0s',
        classificationType: interval.classificationType || 'Desconocido',
        isStart: false,
        isEnd: true
      })
    }
  })

  // Ordenar puntos por tiempo
  chartPoints.sort((a, b) => {
    return a.x.getTime() - b.x.getTime()
  })

  const labels = chartPoints.map(point => point.x)
  const speedData = chartPoints.map(point => point.speed)
  const stateData = chartPoints.map(point => point.state)

  const datasets = [
    {
      type: 'line' as const,
      label: 'Velocidad (nudos)',
      data: speedData,
      backgroundColor: 'rgba(59, 130, 246, 0.3)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 3,
      fill: true,
      tension: 0,
      stepped: 'after' as const,
      pointBackgroundColor: 'rgba(59, 130, 246, 1)',
      pointBorderColor: 'rgba(59, 130, 246, 1)',
      pointBorderWidth: 0,
      pointRadius: 2,
      pointHoverRadius: 4,
      xAxisID: 'x',
      yAxisID: 'y',
    },
    {
      type: 'line' as const,
      label: 'Nav Status',
      data: stateData,
      backgroundColor: 'rgba(34, 197, 94, 0.3)',
      borderColor: 'rgba(34, 197, 94, 1)',
      borderWidth: 3,
      fill: false,
      tension: 0,
      stepped: 'after' as const,
      pointBackgroundColor: 'rgba(34, 197, 94, 1)',
      pointBorderColor: 'rgba(34, 197, 94, 1)',
      pointBorderWidth: 0,
      pointRadius: 2,
      pointHoverRadius: 4,
      xAxisID: 'x',
      yAxisID: 'y1',
    }
  ]

  return {
    labels,
    datasets,
    chartPoints, // Agregar los puntos para usar en tooltips
    allData: {
      labels,
      datasets,
      chartPoints
    }
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
}

const PieChart: React.FC<PieChartProps> = ({ data, totalSeconds }) => {
  const size = 280
  const radius = size / 2 - 15
  const centerX = size / 2
  const centerY = size / 2
  
  let currentAngle = 0
  
  const paths = data.map(([classificationType, groupData], index) => {
    const percentage = groupData.totalSeconds / totalSeconds
    const angle = percentage * 360
    const color = CHART_COLORS[index % CHART_COLORS.length]
    
    // Calcular las coordenadas del arco
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    
    const startAngleRad = (startAngle * Math.PI) / 180
    const endAngleRad = (endAngle * Math.PI) / 180
    
    const x1 = centerX + radius * Math.cos(startAngleRad)
    const y1 = centerY + radius * Math.sin(startAngleRad)
    const x2 = centerX + radius * Math.cos(endAngleRad)
    const y2 = centerY + radius * Math.sin(endAngleRad)
    
    const largeArcFlag = angle > 180 ? 1 : 0
    
    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ')
    
    currentAngle += angle
    
    return (
      <path
        key={classificationType}
        d={pathData}
        fill={color}
        stroke="#374151"
        strokeWidth="0.5"
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
  // TODOS LOS HOOKS DEBEN ESTAR AL INICIO, ANTES DE CUALQUIER RETURN CONDICIONAL
  const [zoomLevel, setZoomLevel] = React.useState(1)
  const [timeRange, setTimeRange] = React.useState<{min: Date | null, max: Date | null}>({min: null, max: null})
  const [panOffset, setPanOffset] = React.useState(0) // Offset para el pan
  const [isPanning, setIsPanning] = React.useState(false)
  const [lastMouseX, setLastMouseX] = React.useState(0)
  const [selectedInterval, setSelectedInterval] = React.useState<IntervalData | null>(null)
  
  const intervalData = extractIntervalData(csvResults, selectedJourneys)
  const groupedData = groupByClassification(intervalData)
  
  const getFullTimeRange = () => {
    if (intervalData.length === 0) return {min: new Date(), max: new Date()}
    
    const allTimes = intervalData
      .map(interval => [new Date(interval.startTime || 0), new Date(interval.endTime || 0)])
      .flat()
      .sort((a, b) => a.getTime() - b.getTime())
    
    return {
      min: allTimes[0],
      max: allTimes[allTimes.length - 1]
    }
  }
  
  const adjustTimeRange = React.useCallback((level: number, offset: number = 0) => {
    if (intervalData.length === 0) return
    
    const {min: minTime, max: maxTime} = getFullTimeRange()
    const totalDuration = maxTime.getTime() - minTime.getTime()
    
    // Calcular el rango visible basado en el nivel de zoom
    const visibleDuration = totalDuration / level
    let center = (minTime.getTime() + maxTime.getTime()) / 2
    
    // Aplicar offset del pan
    if (level > 1) {
      center += offset
      
      // Limitar el pan para no salirse de los datos
      const maxOffset = (totalDuration - visibleDuration) / 2
      center = Math.max(
        minTime.getTime() + visibleDuration / 2,
        Math.min(maxTime.getTime() - visibleDuration / 2, center)
      )
    }
    
    setTimeRange({
      min: new Date(center - visibleDuration / 2),
      max: new Date(center + visibleDuration / 2)
    })
  }, [intervalData])
  
  // Función para encontrar el intervalo que contiene una posición temporal
  const findIntervalAtTime = React.useCallback((timestamp: number) => {
    return intervalData.find(interval => {
      const startTime = new Date(interval.startTime || 0).getTime()
      const endTime = new Date(interval.endTime || 0).getTime()
      return timestamp >= startTime && timestamp <= endTime
    })
  }, [intervalData])
  
  if (!isVisible) {
    return null
  }

  // Validar que hay datos
  if (!intervalData || intervalData.length === 0) {
    return (
      <div 
        className="fixed inset-0 z-[999999] flex items-center justify-center bg-black bg-opacity-80 stats-modal" 
        onClick={onClose}
      >
        <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
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
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose()
          }
        }}
      >
        <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-2xl w-full mx-4" style={{ backgroundColor: 'rgba(31, 41, 55, 0.95)', zIndex: 999999 }}>
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

  // Preparar datos para el gráfico
  const chartData = prepareChartData(intervalData)
  
  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const newLevel = Math.min(prev + 0.3, 3)
      adjustTimeRange(newLevel, panOffset)
      return newLevel
    })
  }
  
  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newLevel = Math.max(prev - 0.3, 0.5)
      adjustTimeRange(newLevel, panOffset)
      return newLevel
    })
  }
  
  const resetZoom = () => {
    setZoomLevel(1)
    setPanOffset(0)
    setTimeRange({min: null, max: null})
  }
  
  
  // Funciones optimizadas para pan con ratón
  const handleMouseDown = (event: React.MouseEvent) => {
    if (zoomLevel <= 1) return // Solo permitir pan cuando hay zoom
    
    event.preventDefault()
    setIsPanning(true)
    setLastMouseX(event.clientX)
    
    // Cambiar cursor solo en el área del gráfico
    const chartContainer = event.currentTarget as HTMLElement
    chartContainer.style.cursor = 'grabbing'
  }
  
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isPanning || zoomLevel <= 1) return
    
    event.preventDefault()
    
    const deltaX = event.clientX - lastMouseX
    
    // Solo procesar si hay movimiento significativo (optimización)
    if (Math.abs(deltaX) < 2) return
    
    const {min: minTime, max: maxTime} = getFullTimeRange()
    const totalDuration = maxTime.getTime() - minTime.getTime()
    const visibleDuration = totalDuration / zoomLevel
    
    // Convertir movimiento del ratón a movimiento temporal
    // Sensibilidad reducida para mejor control
    const sensitivity = 1.5
    const timeDelta = (deltaX / 400) * visibleDuration * sensitivity
    
    setPanOffset(prev => {
      const newOffset = prev - timeDelta
      adjustTimeRange(zoomLevel, newOffset)
      return newOffset
    })
    
    setLastMouseX(event.clientX)
  }
  
  const handleMouseUp = (event: React.MouseEvent) => {
    if (!isPanning) return
    
    setIsPanning(false)
    
    // Restaurar cursor normal solo en el área del gráfico
    const chartContainer = event.currentTarget as HTMLElement
    chartContainer.style.cursor = zoomLevel > 1 ? 'grab' : 'default'
  }
  
  const handleMouseLeave = (event: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false)
      const chartContainer = event.currentTarget as HTMLElement
      chartContainer.style.cursor = zoomLevel > 1 ? 'grab' : 'default'
    }
  }
  
  const handleMouseEnter = (event: React.MouseEvent) => {
    // Solo cambiar cursor cuando hay zoom y no estamos haciendo pan
    if (zoomLevel > 1 && !isPanning) {
      const chartContainer = event.currentTarget as HTMLElement
      chartContainer.style.cursor = 'grab'
    }
  }
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time' as const,
        min: timeRange.min ? timeRange.min.toISOString() : undefined,
        max: timeRange.max ? timeRange.max.toISOString() : undefined,
        time: {
          displayFormats: {
            millisecond: 'HH:mm:ss.SSS',
            second: 'HH:mm:ss',
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MM/dd',
            week: 'MM/dd',
            month: 'MM/yyyy',
            quarter: 'MM/yyyy',
            year: 'yyyy'
          },
          tooltipFormat: 'MM/dd HH:mm',
          unit: (zoomLevel >= 2.5 ? 'minute' : zoomLevel >= 1.5 ? 'hour' : 'day') as 'minute' | 'hour' | 'day',
          stepSize: zoomLevel >= 2.5 ? 15 : zoomLevel >= 2 ? 30 : zoomLevel >= 1.5 ? 1 : 1
        },
        ticks: {
          color: '#9CA3AF',
          maxTicksLimit: Math.max(3, Math.floor(12 / zoomLevel)),
          callback: function(value: any) {
            const date = new Date(value)
            if (zoomLevel >= 2.5) {
              // Zoom muy alto: mostrar minutos
              return date.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })
            } else if (zoomLevel >= 1.5) {
              // Zoom medio: mostrar horas
              return date.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              })
            } else {
              // Zoom bajo: mostrar solo horas
              return date.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                hour12: false
              })
            }
          }
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.5)',
          lineWidth: 1
        }
      },
      x1: {
        type: 'time' as const,
        position: 'top' as const,
        display: true,
        min: timeRange.min ? timeRange.min.toISOString() : undefined,
        max: timeRange.max ? timeRange.max.toISOString() : undefined,
        time: {
          displayFormats: {
            day: 'MM/dd',
            hour: 'HH:mm',
            minute: 'HH:mm'
          },
          tooltipFormat: 'MM/dd',
          unit: (zoomLevel >= 2.5 ? 'hour' : 'day') as 'hour' | 'day',
          stepSize: zoomLevel >= 2.5 ? 2 : 1
        },
        ticks: {
          color: '#9CA3AF',
          maxTicksLimit: Math.max(2, Math.floor(6 / zoomLevel)),
          font: {
            size: 11
          },
          callback: function(value: any) {
            const date = new Date(value)
            if (zoomLevel >= 2.5) {
              // Zoom muy alto: mostrar horas en eje superior
              return date.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                hour12: false
              })
            } else {
              // Zoom normal: mostrar fechas
              return date.toLocaleDateString('es-ES', {
                month: '2-digit',
                day: '2-digit'
              })
            }
          }
        },
        grid: {
          display: true,
          color: 'rgba(107, 114, 128, 0.2)',
          lineWidth: 1,
          drawOnChartArea: true
        },
        title: {
          display: true,
          text: zoomLevel >= 2.5 ? 'Horas' : 'Días',
          color: '#9CA3AF',
          font: {
            size: 12
          }
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Velocidad (nudos)',
          color: '#3B82F6'
        },
        ticks: {
          color: '#3B82F6'
        },
        grid: {
          color: 'rgba(59, 130, 246, 0.4)',
          lineWidth: 1
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Nav Status',
          color: '#22C55E'
        },
        ticks: {
          color: '#22C55E',
          stepSize: 1,
          callback: function(value: any) {
            const stateLabels: { [key: string]: string } = {
              '0.0': 'Atracado/Parada',
              '1.0': 'Maniobrando', 
              '2.0': 'Navegando'
            }
            return stateLabels[value.toString()] || value
          }
        },
        grid: {
          drawOnChartArea: false,
          color: 'rgba(34, 197, 94, 0.4)',
          lineWidth: 1
        },
      }
    },
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Perfil de velocidad por trayecto',
        color: '#FFFFFF',
        font: {
          size: 16
        }
      },
      tooltip: {
        enabled: false
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    onHover: (event: any, activeElements: any) => {
      // Cambiar cursor para indicar que se puede hacer clic en cualquier parte del área
      event.native.target.style.cursor = zoomLevel > 1 ? 'grab' : 'pointer'
    },
    onClick: function(event: any, elements: any) {
      if (elements.length > 0) {
        // Actualizar el intervalo seleccionado para los paneles
        const pointIndex = elements[0].index
        const chartPoints = chartData.chartPoints
        if (chartPoints && chartPoints[pointIndex]) {
          const point = chartPoints[pointIndex]
          const interval = intervalData.find(interval => 
            interval.intervalNumber === point.intervalNumber
          )
          if (interval) {
            setSelectedInterval(interval)
          }
        }
      }
    },
    elements: {
      line: {
        borderJoinStyle: 'miter' as const,
      },
      point: {
        hoverBackgroundColor: '#FFFFFF',
        hoverBorderColor: '#3B82F6',
        hoverBorderWidth: 3,
      }
    },
    animation: false as const
  }

  return (
    <div 
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black bg-opacity-80 stats-modal" 
      style={{ zIndex: 999999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-6xl w-full mx-4 max-h-[95vh] overflow-y-auto" style={{ backgroundColor: 'rgba(31, 41, 55, 0.95)', zIndex: 999999 }}>
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
          
          {/* Gráfico principal */}
          <div className="mb-6">
            <div className="bg-gray-700 rounded-lg p-6">
              {/* Controles de zoom */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <button
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 3}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                  title="Acercar"
                >
                  🔍+
                </button>
                <button
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.5}
                  className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                  title="Alejarse"
                >
                  🔍-
                </button>
                <button
                  onClick={resetZoom}
                  className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
                  title="Reset"
                >
                  ↻
                </button>
              </div>
              
              <div className="flex gap-6">
                {/* Gráfico */}
                <div className="flex-1">
                  <div 
                    className="h-[32rem] relative"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onMouseEnter={handleMouseEnter}
                    style={{ 
                      cursor: zoomLevel > 1 ? 'grab' : 'default',
                      userSelect: 'none', // Prevenir selección de texto durante el pan
                      overflow: 'hidden' // Evitar que el cursor se propague fuera del contenedor
                    }}
                  >
                    <Chart 
                      type="line" 
                      data={chartData} 
                      options={chartOptions} 
                    />
                  </div>
                </div>
                
                {/* Paneles de leyenda */}
                <div className="w-64 space-y-3">
                  <div className="text-sm text-gray-300 font-medium mb-3">Detalles del Intervalo</div>
                  
                  {/* Estado */}
                  <div className="bg-gray-600 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Estado</div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 bg-green-500 rounded"></div>
                      <span className="text-sm text-white">
                        {selectedInterval?.navStatus ? 
                          (parseFloat(selectedInterval.navStatus) === 0 ? 'Atracado/Parada' :
                           parseFloat(selectedInterval.navStatus) === 1 ? 'Maniobrando' : 'Navegando') 
                          : '--'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actividad */}
                  <div className="bg-gray-600 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Actividad</div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 bg-purple-500 rounded"></div>
                      <span className="text-sm text-white">
                        {selectedInterval?.classificationType || '--'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Velocidad Media */}
                  <div className="bg-gray-600 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Velocidad Media</div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 bg-blue-500 rounded"></div>
                      <span className="text-sm text-white">
                        {selectedInterval?.avgSpeed ? `${selectedInterval.avgSpeed.toFixed(2)} kn` : '-- kn'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Duración */}
                  <div className="bg-gray-600 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Duración</div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 bg-orange-500 rounded"></div>
                      <span className="text-sm text-white">
                        {selectedInterval?.duration || '--:--:--'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Hora Inicial */}
                  <div className="bg-gray-600 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Hora Inicial</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">
                        {selectedInterval?.startTime ? 
                          new Date(selectedInterval.startTime).toLocaleTimeString('es-ES', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            hour12: false 
                          }) : '--:--'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Hora Final */}
                  <div className="bg-gray-600 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Hora Final</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">
                        {selectedInterval?.endTime ? 
                          new Date(selectedInterval.endTime).toLocaleTimeString('es-ES', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            hour12: false 
                          }) : '--:--'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Fecha */}
                  <div className="bg-gray-600 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Fecha</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">
                        {selectedInterval?.startTime ? 
                          new Date(selectedInterval.startTime).toLocaleDateString('es-ES', { 
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }) : '--'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          


          {/* Gráfico de quesos (pie chart) */}
          <div className="mb-6">
            <div className="text-xl font-medium text-white mb-6">Distribución por sectores</div>
            <div className="flex flex-col items-center gap-8">
              <div className="flex justify-center">
                <PieChart data={sortedGroups} totalSeconds={totalSeconds} />
              </div>
              <div className="w-full max-w-5xl">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedGroups.map(([classificationType, data], index) => {
                    const percentage = ((data.totalSeconds / totalSeconds) * 100).toFixed(1)
                    const color = CHART_COLORS[index % CHART_COLORS.length]
                    
                    return (
                      <div key={classificationType} className="flex items-start gap-3 bg-gray-700 rounded-lg p-3 min-h-[80px]">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1 text-gray-300 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm leading-tight truncate pr-2" title={classificationType}>
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
