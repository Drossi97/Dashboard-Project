import React from "react"
import { CSVIntervalResult } from "../hooks/useCSVInterval"
import { getJourneyColor } from "../lib/colors"

interface Journey {
  index: number
  startPort: string
  endPort: string
  intervalCount: number
  classificationTypes: string[]
  hasGaps: boolean
  gapCount: number
  gapDurations: string[]
  isIncomplete: boolean
  startDate: string
  startTime: string
  endTime: string
  totalDuration: string
}

interface JourneySelectorProps {
  csvResults: CSVIntervalResult | null
  selectedJourneys: Set<number>
  onToggleJourney: (journeyIndex: number) => void
  onShowStats: () => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

// Función para calcular la duración total de un trayecto
const calculateJourneyDuration = (intervals: any[]): string => {
  if (intervals.length === 0) return '0s'
  
  const totalSeconds = intervals.reduce((sum, interval) => {
    const duration = interval.duration || '0s'
    return sum + parseDurationToSeconds(duration)
  }, 0)
  
  return formatDuration(totalSeconds)
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

// Función para extraer información de trayectos desde los resultados de CSV
const extractJourneysFromResults = (csvResults: CSVIntervalResult | null): Journey[] => {
  
  if (!csvResults?.success || !csvResults.data?.intervals) {
    return []
  }

  const intervals = csvResults.data.intervals
  
  const journeyMap = new Map<number, {
    intervals: any[]
    classificationTypes: Set<string>
    gaps: number
    gapDurations: string[]
    isIncomplete: boolean
  }>()

  // Procesar intervalos y separadores
  intervals.forEach((item: any, index: number) => {
    
    if (item.separator) {
      // Es un separador con información del intervalo
      const journeyIndex = item.journeyIndex
      
      if (!journeyMap.has(journeyIndex)) {
        journeyMap.set(journeyIndex, {
          intervals: [],
          classificationTypes: new Set(),
          gaps: 0,
          gapDurations: [],
          isIncomplete: item.isIncomplete || false
        })
      }
      
      const journey = journeyMap.get(journeyIndex)!
      journey.classificationTypes.add(item.classificationType)
      if (item.hasGap) {
        journey.gaps++
        if (item.gapDuration) {
          journey.gapDurations.push(item.gapDuration)
        }
      }
      // Actualizar el estado de incompleto desde el separador
      journey.isIncomplete = item.isIncomplete || false
    } else {
      // Es un intervalo real - debe tener journeyIndex para agruparlo en el trayecto correcto
      const journeyIndex = item.journeyIndex
      if (!journeyIndex || typeof journeyIndex !== 'number') {
        return
      }
      
      // Agregar el intervalo al trayecto correspondiente
      if (!journeyMap.has(journeyIndex)) {
        journeyMap.set(journeyIndex, {
          intervals: [],
          classificationTypes: new Set(),
          gaps: 0,
          gapDurations: [],
          isIncomplete: false // Se establecerá desde el separador
        })
      }
      
      journeyMap.get(journeyIndex)!.intervals.push(item)
    }
  })

  // Convertir a array de Journey
  const journeys: Journey[] = []
  journeyMap.forEach((data: any, journeyIndex: number) => {
    const intervals = data.intervals
    if (intervals.length === 0) {
      return
    }

    const firstInterval = intervals[0]
    const lastInterval = intervals[intervals.length - 1]
    
    const startPort = firstInterval.startPortDistances?.nearestPort || 'Desconocido'
    const endPort = lastInterval.endPortDistances?.nearestPort || 'Desconocido'
    
    // Usar la información de incompleto del JSON en lugar de calcularla
    const isIncomplete = data.isIncomplete
    
    // Para trayectos incompletos, no mostrar ruta específica
    const displayRoute = isIncomplete ? 'Trayecto incompleto' : `${startPort} → ${endPort}`

    // Extraer información temporal
    const startDate = firstInterval.startTime ? new Date(firstInterval.startTime).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
    const startTime = firstInterval.startTime ? new Date(firstInterval.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
    const endTime = lastInterval.endTime ? new Date(lastInterval.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
    const totalDuration = calculateJourneyDuration(intervals)

    journeys.push({
      index: journeyIndex,
      startPort,
      endPort: displayRoute,
      intervalCount: intervals.length,
      classificationTypes: Array.from(data.classificationTypes),
      hasGaps: data.gaps > 0,
      gapCount: data.gaps,
      gapDurations: data.gapDurations,
      isIncomplete,
      startDate,
      startTime,
      endTime,
      totalDuration
    })
  })

  const sortedJourneys = journeys.sort((a, b) => a.index - b.index)
  return sortedJourneys
}


export default function JourneySelector({ 
  csvResults, 
  selectedJourneys, 
  onToggleJourney, 
  onShowStats,
  onSelectAll,
  onDeselectAll
}: JourneySelectorProps) {
  
  const availableJourneys = extractJourneysFromResults(csvResults)


  return (
    <div className="absolute top-4 right-4 z-[99999] interface-component journey-selector" style={{ zIndex: 99999 }}>
      <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-80 sm:w-96 max-w-none max-h-[calc(100vh-3rem)]" style={{ zIndex: 99999, backgroundColor: '#1F2937' }}>
        <div className="px-4 pt-3 pb-3 pl-6 pr-2">
          {/* Título */}
          <div className="mb-2 text-center">
            <h4 className="text-white font-medium">Seleccionar Trayecto</h4>
          </div>
          
          {/* Línea separadora */}
          <div className="border-b border-gray-600 mb-2"></div>
          
          {/* Botón de estadísticas */}
          <div className="flex justify-center mb-2">
            <button
              onClick={onShowStats}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Estadísticas
            </button>
          </div>
          
          {/* Checkbox para seleccionar todos - reorganizado */}
          {availableJourneys.length > 0 && (
            <div className="flex items-center justify-end gap-2 mb-2 pb-1 border-b border-gray-600">
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
          
          <div 
            className="space-y-1 max-h-[calc(100vh-400px)] sm:max-h-[500px] overflow-y-auto"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#6B7280 transparent'
            }}
          >
            {availableJourneys.length > 0 ? (
              availableJourneys.map((journey) => {
              const isSelected = selectedJourneys.has(journey.index)
              const journeyColor = getJourneyColor(journey.index)
              
              return (
                 <div
                   key={journey.index}
                   onClick={() => onToggleJourney(journey.index)}
                   className={`w-full rounded-lg transition-all duration-200 border-2 overflow-hidden cursor-pointer ${
                     isSelected
                       ? 'bg-gray-700 text-gray-300 border-gray-600'
                       : 'bg-gray-700 text-gray-300 border-gray-600'
                   }`}
                 >
                   {/* Encabezado del trayecto */}
                   <div className={`w-full text-left px-4 py-3 border-b transition-colors border-gray-600`}
                     style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)' }}
                   >
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div 
                           className="w-5 h-5 rounded-full shadow-sm border-2 border-white/20"
                           style={{ backgroundColor: journeyColor }}
                         />
                         <div>
                           <div className="font-bold text-lg">
                             Trayecto {journey.index}
                           </div>
                           <div 
                             className="text-sm font-medium" 
                             style={{ color: journey.isIncomplete ? '#FB923C' : '#9CA3AF' }}
                           >
                             {journey.endPort}
                           </div>
                         </div>
                       </div>
                       
                       {/* Checkbox visual para indicar selección */}
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
                  
                  {/* Contenido informativo */}
                  <div className="p-4 space-y-3">
                     {/* Información temporal organizada */}
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <div className="text-xs mb-1 text-gray-400">
                           Fecha
                         </div>
                         <div className="text-sm font-medium">
                           {journey.startDate}
                         </div>
                       </div>
                       <div>
                         <div className="text-xs mb-1 text-gray-400">
                           Intervalos
                         </div>
                         <div className="text-sm font-medium">
                           {journey.intervalCount}
                         </div>
                       </div>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <div className="text-xs mb-1 text-gray-400">
                           Inicio
                         </div>
                         <div className="text-sm font-medium">
                           {journey.startTime}
                         </div>
                       </div>
                       <div>
                         <div className="text-xs mb-1 text-gray-400">
                           Final
                         </div>
                         <div className="text-sm font-medium">
                           {journey.endTime}
                         </div>
                       </div>
                     </div>
                     
                     <div>
                       <div className="text-xs mb-1 text-gray-400">
                         Duración
                       </div>
                       <div className="text-sm font-semibold text-blue-400">
                         {journey.totalDuration}
                       </div>
                     </div>
                    
                    {/* Advertencia de gaps */}
                    {journey.hasGaps && (
                      <div className="mt-3 rounded-lg p-2 bg-orange-500/20 border border-orange-500/30">
                        <div className="flex items-center gap-2 text-xs text-orange-300">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <div>{journey.gapCount} gap{journey.gapCount > 1 ? 's' : ''} detectado{journey.gapCount > 1 ? 's' : ''}</div>
                            {journey.gapDurations.length > 0 && (
                              <div className="text-orange-200 mt-1">
                                Duración: {journey.gapDurations.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                     )}
                   </div>
                </div>
              )
              })
            ) : (
              <div className="text-center text-gray-300 py-4">
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


