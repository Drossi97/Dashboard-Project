import React from "react"
import { CSVIntervalResult } from "../hooks/useCSVInterval"
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { parseDurationToSeconds, formatDuration } from "../lib/utils"

interface ActivityDistributionProps {
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

  return Object.values(grouped)
    .filter(item => item.duration > 0) // Filtrar actividades con duración 0
    .map((item, index) => ({
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length],
      percentage: totalDuration > 0 ? (item.duration / totalDuration * 100) : 0
    }))
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
      <style dangerouslySetInnerHTML={{
        __html: `
          .activity-scroll::-webkit-scrollbar {
            width: 0px;
            background: transparent;
          }
          .activity-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .activity-scroll::-webkit-scrollbar-thumb {
            background: transparent;
            border-radius: 4px;
          }
          .activity-scroll::-webkit-scrollbar-thumb:hover {
            background: transparent;
          }
        `
      }} />
      <div className="w-[calc(100vw-23rem)] max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] rounded-xl p-4 shadow-2xl border border-gray-700 overflow-hidden" style={{ backgroundColor: '#1F2937' }}>
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
                  className="flex items-center gap-2 px-4 py-2 text-white text-sm rounded-md shadow-sm transition-all duration-200"
                  style={{ backgroundColor: '#2563EB' }}
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

          {/* Contenido principal */}
          <div className="flex-1 flex flex-col min-h-0">
            {intervalData.length > 0 ? (
              <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6 h-full">
                {/* Pie Chart */}
                <div className="flex-1 rounded-lg p-3 sm:p-4 lg:p-6 min-w-0 overflow-hidden" style={{ backgroundColor: '#2D3748' }}>
                  <div className="h-full min-h-[250px] sm:min-h-[300px] lg:min-h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={groupByClassification(intervalData)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={false}
                          outerRadius="80%"
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
                </div>
                
                {/* Leyenda */}
                <div className="flex-shrink-0 w-full lg:w-80 rounded-lg p-3 sm:p-4 lg:p-6 overflow-hidden" style={{ backgroundColor: '#2D3748' }}>
                  <div className="space-y-1 h-full max-h-[200px] sm:max-h-[250px] lg:max-h-none overflow-y-auto overflow-x-hidden activity-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <div className="flex items-center justify-between text-sm font-semibold text-gray-300 mb-2 p-1 rounded" style={{ backgroundColor: '#2D3748' }}>
                      <span>Tiempo Total:</span>
                      <span>{formatDuration(intervalData.reduce((total, interval) => total + interval.durationInSeconds, 0))}</span>
                    </div>
                    <div className="border-b border-gray-600 mb-2"></div>
                    {groupByClassification(intervalData).map((item, index) => (
                      <div 
                        key={index} 
                        className={`cursor-pointer transition-all duration-200 rounded p-2 hover:bg-gray-700 ${
                          hoveredIndex === index 
                            ? 'bg-gray-700' 
                            : ''
                        }`}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <div 
                            className={`w-3 h-3 rounded-full transition-all duration-200 flex-shrink-0 ${
                              hoveredIndex === index ? 'scale-110 shadow-md' : ''
                            }`}
                            style={{ 
                              backgroundColor: item.color,
                              boxShadow: hoveredIndex === index ? `0 0 8px ${item.color}40` : 'none'
                            }}
                          />
                          <span className={`transition-colors duration-200 text-sm ${
                            hoveredIndex === index ? 'text-white' : 'text-gray-300'
                          }`}>{item.name}</span>
                        </div>
                        <div className={`transition-colors duration-200 text-xs ml-5 ${
                          hoveredIndex === index ? 'text-gray-200' : 'text-gray-400'
                        }`}>{formatDuration(item.duration)} ({item.percentage.toFixed(1)}%)</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center" style={{ color: '#9CA3AF' }}>
                  <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-semibold text-white mb-2">Sin datos de actividades</h4>
                  <p style={{ color: '#9CA3AF' }}>Selecciona trayectos para ver la distribución</p>
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
