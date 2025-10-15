import React from "react"
import { CSVIntervalResult } from "../hooks/useCSVInterval"
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface ActivityDistributionProps {
  csvResults: CSVIntervalResult | null
  selectedJourneys: Set<number>
  isVisible: boolean
  onClose: () => void
  onViewChange?: (view: 'speed' | 'activity') => void
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

// Colores para el pie chart
const CHART_COLORS = [
  '#3B82F6', // Azul
  '#10B981', // Verde
  '#F59E0B', // Amarillo
  '#EF4444', // Rojo
  '#8B5CF6', // Púrpura
  '#EC4899', // Rosa
  '#06B6D4', // Cian
  '#84CC16', // Lima
  '#F97316', // Naranja
]

// Función para agrupar datos por clasificación
const groupByClassification = (intervalData: IntervalData[]) => {
  const grouped = intervalData.reduce((acc, interval) => {
    const key = interval.classificationType
    if (!acc[key]) {
      acc[key] = {
        name: key,
        value: 0,
        duration: 0
      }
    }
    acc[key].value += 1
    acc[key].duration += interval.durationInSeconds
    return acc
  }, {} as Record<string, { name: string, value: number, duration: number }>)

  // Calcular la duración total para obtener porcentajes correctos
  const totalDuration = intervalData.reduce((total, interval) => total + interval.durationInSeconds, 0)

  return Object.values(grouped).map((item, index) => ({
    ...item,
    color: CHART_COLORS[index % CHART_COLORS.length],
    percentage: totalDuration > 0 ? (item.duration / totalDuration * 100) : 0
  }))
}

// Función para convertir duración a segundos
const parseDurationToSeconds = (duration: string): number => {
  try {
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

// Función para formatear duración en segundos a formato legible
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  } else {
    return `${remainingSeconds}s`
  }
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

const ActivityDistribution: React.FC<ActivityDistributionProps> = ({ csvResults, selectedJourneys, isVisible, onClose, onViewChange }) => {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)
  
  // Extraer datos de intervalos
  const intervalData = React.useMemo(() => {
    const data = extractIntervalData(csvResults, selectedJourneys)
    return data
  }, [csvResults, selectedJourneys])

  if (!isVisible) return null

  return (
    <div className="fixed top-4 left-4 z-[999998] dashboard-component">
      <div className="w-[calc(100vw-23rem)] max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] rounded-xl p-4 shadow-2xl border border-gray-700 overflow-hidden" style={{ backgroundColor: '#18202F' }}>
        <div className="flex flex-col h-full">
          {/* Encabezado con pestañas y botón de cerrar */}
          <div className="flex items-center justify-between mb-4">
            {/* Pestañas de navegación */}
            {onViewChange && (
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => onViewChange('speed')}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 text-sm rounded-md transition-all duration-200"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Perfil de Velocidad
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-md shadow-sm transition-all duration-200"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                  Distribución de Actividades
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

          {/* Contenido principal */}
          <div className="flex-1 flex flex-col">
            {intervalData.length > 0 ? (
              <div className="flex gap-6 h-full">
                {/* Pie Chart responsivo */}
                <div className="flex-1 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={groupByClassification(intervalData)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={false}
                        outerRadius={Math.min(180, Math.max(140, 200 - groupByClassification(intervalData).length * 3))}
                        innerRadius={Math.min(80, Math.max(60, 100 - groupByClassification(intervalData).length * 2))}
                        fill="#8884d8"
                        dataKey="duration"
                        onMouseEnter={(data, index) => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {groupByClassification(intervalData).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color}
                            stroke={hoveredIndex === index ? '#FFFFFF' : 'none'}
                            strokeWidth={hoveredIndex === index ? 3 : 0}
                            style={{
                              filter: hoveredIndex !== null && hoveredIndex !== index ? 'opacity(0.3)' : 'opacity(1)',
                              transition: 'all 0.2s ease-in-out'
                            }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Leyenda responsiva */}
                <div className={`flex-shrink-0 ${groupByClassification(intervalData).length > 6 ? 'w-64' : 'w-72'}`}>
                  <div className={`space-y-2 ${groupByClassification(intervalData).length > 8 ? 'max-h-96 overflow-y-auto' : ''}`}>
                    {groupByClassification(intervalData).map((entry, index) => (
                      <div 
                        key={index} 
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200 ${
                          hoveredIndex === index 
                            ? 'bg-gray-700 scale-105 shadow-lg' 
                            : 'hover:bg-gray-800'
                        }`}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
             <div 
               className={`w-4 h-4 rounded-full flex-shrink-0 transition-all duration-200 ${
                 hoveredIndex === index ? 'scale-110 shadow-md' : ''
               }`}
               style={{ 
                 backgroundColor: 'transparent',
                 border: `2px solid ${entry.color}`,
                 boxShadow: hoveredIndex === index ? `0 0 8px ${entry.color}40` : 'none'
               }}
             ></div>
                        <div className="flex flex-col min-w-0">
                          <span className={`font-medium truncate transition-colors duration-200 ${
                            groupByClassification(intervalData).length > 8 ? 'text-sm' : 'text-base'
                          } ${
                            hoveredIndex === index ? 'text-white' : 'text-gray-300'
                          }`}>
                            {entry.name}
                          </span>
                          <span className={`transition-colors duration-200 ${
                            groupByClassification(intervalData).length > 8 ? 'text-sm' : 'text-sm'
                          } ${
                            hoveredIndex === index ? 'text-gray-200' : 'text-gray-400'
                          }`}>
                            {formatDuration(entry.duration)} ({entry.percentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Tiempo total */}
                  <div className="mt-6 pt-4 border-t border-gray-600">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-gray-500 rounded-md flex-shrink-0"></div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-gray-200 font-semibold text-base">Tiempo Total</span>
                        <span className="text-gray-300 text-sm">
                          {formatDuration(intervalData.reduce((total, interval) => total + interval.durationInSeconds, 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Estadísticas adicionales */}
                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Total de Intervalos:</span>
                        <span className="text-white font-semibold text-sm">{intervalData.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Tipos de Actividad:</span>
                        <span className="text-white font-semibold text-sm">{groupByClassification(intervalData).length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Trayectos Seleccionados:</span>
                        <span className="text-white font-semibold text-sm">{selectedJourneys.size}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-semibold text-white mb-2">Sin datos de actividades</h4>
                  <p className="text-gray-400">Selecciona trayectos para ver la distribución</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ActivityDistribution
