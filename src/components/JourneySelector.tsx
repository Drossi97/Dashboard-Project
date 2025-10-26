import React from "react"
import { CSVIntervalResult, Journey } from "../hooks/useCSVInterval"
import { getJourneyColor } from "../lib/colors"

interface JourneySelectorProps {
  csvResults: CSVIntervalResult | null
  selectedJourneys: Set<number>
  onToggleJourney: (journeyIndex: number) => void
  onShowStats: () => void
  onStatsViewChange: (view: 'speed' | 'activity' | 'comparison') => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onToggleMultipleJourneys?: (journeyIndices: number[]) => void
}

// Función helper para formatear fecha
const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return ''
  }
}

// Función helper para formatear hora
const formatTime = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'h'
  } catch {
    return ''
  }
}

export default function JourneySelector({
  csvResults,
  selectedJourneys,
  onToggleJourney,
  onShowStats,
  onStatsViewChange,
  onSelectAll,
  onDeselectAll,
  onToggleMultipleJourneys
}: JourneySelectorProps) {

  const availableJourneys = csvResults?.success && csvResults.data?.journeys ? csvResults.data.journeys : []
  
  // Estado para controlar qué días están expandidos
  const [expandedDays, setExpandedDays] = React.useState<Set<string>>(new Set())
  
  // Agrupar trayectos por día
  const journeysByDay = React.useMemo(() => {
    const grouped: Record<string, Journey[]> = {}
    
    availableJourneys.forEach(journey => {
      const dayKey = formatDate(journey.metadata.startDate)
      if (!grouped[dayKey]) {
        grouped[dayKey] = []
      }
      grouped[dayKey].push(journey)
    })
    
    // Ordenar días de más antiguo a más reciente
    const sortedDays = Object.keys(grouped).sort((a, b) => {
      const dateA = new Date(a.split('/').reverse().join('-'))
      const dateB = new Date(b.split('/').reverse().join('-'))
      return dateA.getTime() - dateB.getTime()
    })
    
    return { grouped, sortedDays }
  }, [availableJourneys])
  
  // Función para alternar la expansión de un día
  const toggleDayExpansion = (dayKey: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev)
      if (newSet.has(dayKey)) {
        newSet.delete(dayKey)
      } else {
        newSet.add(dayKey)
      }
      return newSet
    })
  }
  
  // Función para seleccionar/deseleccionar todos los trayectos de un día
  const toggleDayJourneys = (dayKey: string) => {
    const dayJourneys = journeysByDay.grouped[dayKey]
    const dayJourneyIndices = dayJourneys.map(j => j.journeyIndex)
    const allSelected = dayJourneyIndices.every(index => selectedJourneys.has(index))
    
    // Si hay una función para manejar múltiples trayectos, usarla
    if (onToggleMultipleJourneys) {
      onToggleMultipleJourneys(dayJourneyIndices)
      return
    }
    
    // Fallback: usar la función individual
    if (allSelected) {
      // Deseleccionar todos los trayectos del día
      dayJourneyIndices.forEach(index => {
        if (selectedJourneys.has(index)) {
          onToggleJourney(index)
        }
      })
    } else {
      // Seleccionar todos los trayectos del día
      dayJourneyIndices.forEach(index => {
        if (!selectedJourneys.has(index)) {
          onToggleJourney(index)
        }
      })
    }
  }

  return (
    <div className="fixed top-4 right-4 z-[999999]" style={{ zIndex: 999999 }}>
      <style dangerouslySetInnerHTML={{
        __html: `
          .journey-scroll::-webkit-scrollbar {
            width: 0px;
            background: transparent;
          }
          .journey-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .journey-scroll::-webkit-scrollbar-thumb {
            background: transparent;
            border-radius: 4px;
          }
          .journey-scroll::-webkit-scrollbar-thumb:hover {
            background: transparent;
          }
        `
      }} />
      <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 w-80 h-[calc(100vh-2rem)] relative flex flex-col" style={{ zIndex: 999999, backgroundColor: '#1F2937' }}>
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          {/* Título */}
          <div className="mb-2 text-center">
            <h4 className="text-white font-medium">Seleccionar Trayecto</h4>
          </div>
          
          {/* Línea separadora */}
          <div className="border-b border-gray-600 mb-2"></div>
          
          {/* Botón de estadísticas */}
          <div className="mb-2">
            <button
              onClick={() => {
                onStatsViewChange('speed')
                onShowStats()
              }}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors w-full"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Estadísticas
            </button>
          </div>
          
          {/* Checkbox para seleccionar todos */}
          {availableJourneys.length > 0 && (
            <div className="flex items-center justify-end gap-2 mb-3 pb-2 border-b border-gray-600">
              <span className="text-sm text-gray-300">
                {selectedJourneys.size === availableJourneys.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
              </span>
              <label className="flex items-center cursor-pointer transition-colors">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={selectedJourneys.size === availableJourneys.length}
                    onChange={selectedJourneys.size === availableJourneys.length ? onDeselectAll : onSelectAll}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${
                    selectedJourneys.size === availableJourneys.length
                      ? 'bg-green-600 border-green-600'
                      : 'bg-transparent border-gray-400 hover:border-gray-300'
                  }`}>
                    {selectedJourneys.size === availableJourneys.length && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>
        
        {/* Área de scroll con padding balanceado */}
        <div 
          className="flex-1 pl-4 pr-4 pb-4 overflow-y-auto journey-scroll" 
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <div className="space-y-2">
            {availableJourneys.length > 0 ? (
              journeysByDay.sortedDays.map((dayKey) => {
                const dayJourneys = journeysByDay.grouped[dayKey]
                const isExpanded = expandedDays.has(dayKey)
                const dayJourneyIndices = dayJourneys.map(j => j.journeyIndex)
                const allSelectedInDay = dayJourneyIndices.every(index => selectedJourneys.has(index))
                
                return (
                  <div key={dayKey} className="space-y-1">
                    {/* Header del día */}
                    <div 
                      className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-700"
                      style={{ backgroundColor: '#374151' }}
                      onClick={() => toggleDayExpansion(dayKey)}
                    >
                      <div className="flex items-center gap-2">
                        <svg 
                          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-white font-medium text-sm">{dayKey}</span>
                        <span className="text-gray-400 text-xs">({dayJourneys.length} trayectos)</span>
                      </div>
                      
                      {/* Checkbox para seleccionar todos los trayectos del día */}
                      <div 
                        className="flex items-center"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleDayJourneys(dayKey)
                        }}
                      >
                        <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors cursor-pointer ${
                          allSelectedInDay
                            ? 'bg-green-600 border-green-600'
                            : 'bg-transparent border-gray-400 hover:border-gray-300'
                        }`}>
                          {allSelectedInDay && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Trayectos del día (solo si está expandido) */}
                    {isExpanded && (
                      <div className="space-y-1">
                        {dayJourneys.map((journey) => {
                          const isSelected = selectedJourneys.has(journey.journeyIndex)
                          const journeyColor = getJourneyColor(journey.journeyIndex)
                          
                          // Formatear fechas y horas
                          const startDate = formatDate(journey.metadata.startDate)
                          const endDate = formatDate(journey.metadata.endDate)
                          const startTime = formatTime(journey.metadata.startTime)
                          const endTime = formatTime(journey.metadata.endTime)
                          
                          // Generar texto de ruta
                          let displayRoute = ''
                          let routeColor = 'text-gray-300'
                          
                          if (journey.metadata.isIncomplete) {
                            displayRoute = 'Trayecto incompleto'
                            routeColor = 'text-orange-400'
                          } else {
                            // Trayecto completo
                            displayRoute = `${journey.metadata.startPort} → ${journey.metadata.endPort}`
                            routeColor = 'text-gray-300'
                            
                            // Verificar si termina navegando cerca (no atracado)
                            const lastInterval = journey.intervals[journey.intervals.length - 1]
                            if (lastInterval?.classificationType?.startsWith("Navegando cerca de")) {
                              routeColor = 'text-blue-300'
                            }
                          }
                          
                          return (
                            <div
                              key={journey.journeyIndex}
                              onClick={() => onToggleJourney(journey.journeyIndex)}
                              className={`w-full rounded-xl transition-all duration-200 overflow-hidden cursor-pointer ${
                                isSelected
                                  ? 'text-gray-300'
                                  : 'text-gray-300'
                              }`}
                              style={{ backgroundColor: '#2D3748' }}
                            >
                              <div className={`w-full text-left px-3 py-2 transition-colors`}
                                style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent' }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded-full shadow-sm border-2 border-white/20"
                                      style={{ backgroundColor: journeyColor }}
                                    />
                                    <div>
                                      <div className="font-bold text-base mb-0.5">
                                        Trayecto {journey.journeyIndex}
                                      </div>

                                      <div className={`text-xs font-medium mb-1 ${routeColor}`}>
                                        {displayRoute}
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold text-blue-400">
                                          {journey.metadata.totalDuration}
                                        </div>
                                        <div className="text-xs text-gray-400 ml-2">
                                          {(() => {
                                            try {
                                              if (startTime && endTime) {
                                                return `(${startTime} → ${endTime})`
                                              }
                                              return '(Horarios no disponibles)'
                                            } catch {
                                              return '(Horarios no disponibles)'
                                            }
                                          })()}
                                        </div>
                                      </div>

                                    </div>
                                  </div>

                                  <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? 'bg-green-600 border-green-600'
                                      : 'bg-transparent border-gray-400'
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="text-center text-gray-300 py-8">
                <p className="text-sm">No hay trayectos disponibles</p>
                <p className="text-xs mt-1">Carga archivos CSV para ver los trayectos</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
