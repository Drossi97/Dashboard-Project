import React from "react"
import { CSVPruebaResult } from "../hooks/useCSVprueba"

// Colores para los trayectos
const JOURNEY_COLORS = [
  '#FF4444', // Rojo brillante
  '#00AA44', // Verde oscuro
  '#0066CC', // Azul oscuro
  '#FF8800', // Naranja brillante
  '#8800AA', // Morado oscuro
  '#CC6600', // Marrón oscuro
  '#00AAAA', // Cian oscuro
  '#AA4400', // Rojo oscuro
  '#0044AA', // Azul muy oscuro
  '#AA0088'  // Magenta oscuro
]

interface Journey {
  index: number
  startPort: string
  endPort: string
  intervalCount: number
  classificationTypes: string[]
  hasGaps: boolean
  gapCount: number
  isIncomplete: boolean
  startDate: string
  startTime: string
  endTime: string
  totalDuration: string
}

interface JourneySelectorProps {
  csvResults: CSVPruebaResult | null
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
const extractJourneysFromResults = (csvResults: CSVPruebaResult | null): Journey[] => {
  console.log('🚀 INICIO extractJourneysFromResults')
  console.log('  - csvResults:', csvResults)
  
  if (!csvResults?.success || !csvResults.data?.intervals) {
    console.log('❌ No hay resultados válidos - csvResults.success:', csvResults?.success, 'intervals:', !!csvResults?.data?.intervals)
    return []
  }

  const intervals = csvResults.data.intervals
  console.log('📊 Total de items en intervals:', intervals.length)
  
  const journeyMap = new Map<number, {
    intervals: any[]
    classificationTypes: Set<string>
    gaps: number
    isIncomplete: boolean
  }>()

  console.log('🔍 Procesando intervalos:', intervals.length)

  // Procesar intervalos y separadores
  intervals.forEach((item: any, index: number) => {
    console.log(`🔍 Procesando item ${index}:`, {
      separator: item.separator,
      intervalNumber: item.intervalNumber,
      journeyIndex: item.journeyIndex,
      classificationType: item.classificationType,
      isIncomplete: item.isIncomplete
    })
    
    if (item.separator) {
      // Es un separador con información del intervalo
      const journeyIndex = item.journeyIndex
      console.log(`📋 Separador encontrado - Trayecto ${journeyIndex}, Clasificación: ${item.classificationType}, Incompleto: ${item.isIncomplete}`)
      
      if (!journeyMap.has(journeyIndex)) {
        journeyMap.set(journeyIndex, {
          intervals: [],
          classificationTypes: new Set(),
          gaps: 0,
          isIncomplete: item.isIncomplete || false
        })
        console.log(`  ✅ Creado nuevo trayecto ${journeyIndex} (incompleto: ${item.isIncomplete})`)
      }
      
      const journey = journeyMap.get(journeyIndex)!
      journey.classificationTypes.add(item.classificationType)
      if (item.hasGap) {
        journey.gaps++
      }
      // Actualizar el estado de incompleto desde el separador
      journey.isIncomplete = item.isIncomplete || false
    } else {
      // Es un intervalo real - debe tener journeyIndex para agruparlo en el trayecto correcto
      const journeyIndex = item.journeyIndex
      if (!journeyIndex || typeof journeyIndex !== 'number') {
        console.log('❌ Intervalo sin journeyIndex válido:', item)
        return
      }
      
      // Agregar el intervalo al trayecto correspondiente
      if (!journeyMap.has(journeyIndex)) {
        journeyMap.set(journeyIndex, {
          intervals: [],
          classificationTypes: new Set(),
          gaps: 0,
          isIncomplete: false // Se establecerá desde el separador
        })
        console.log(`  ✅ Creado nuevo trayecto ${journeyIndex} para intervalo`)
      }
      
      journeyMap.get(journeyIndex)!.intervals.push(item)
      console.log(`  ✅ Agregado intervalo al trayecto ${journeyIndex}`)
    }
  })

  console.log('🗺️ Trayectos encontrados:', Array.from(journeyMap.keys()))

  // Convertir a array de Journey
  const journeys: Journey[] = []
  journeyMap.forEach((data, journeyIndex) => {
    const intervals = data.intervals
    if (intervals.length === 0) {
      console.log(`⚠️ Trayecto ${journeyIndex} sin intervalos`)
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

    console.log(`🚢 Trayecto ${journeyIndex}: ${displayRoute} (${intervals.length} intervalos)${isIncomplete ? ' - INCOMPLETO' : ''} [desde JSON]`)

    journeys.push({
      index: journeyIndex,
      startPort,
      endPort: displayRoute,
      intervalCount: intervals.length,
      classificationTypes: Array.from(data.classificationTypes),
      hasGaps: data.gaps > 0,
      gapCount: data.gaps,
      isIncomplete,
      startDate,
      startTime,
      endTime,
      totalDuration
    })
  })

  const sortedJourneys = journeys.sort((a, b) => a.index - b.index)
  console.log('✅ Trayectos finales:', sortedJourneys)
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
  
  console.log('🎯 JourneySelector renderizado con:', { csvResults, selectedJourneys })
  
  // Debug detallado de los datos recibidos
  console.log('🔍 DEBUG JourneySelector:')
  console.log('  - csvResults existe:', !!csvResults)
  console.log('  - csvResults.success:', csvResults?.success)
  console.log('  - csvResults.data existe:', !!csvResults?.data)
  console.log('  - csvResults.data.intervals existe:', !!csvResults?.data?.intervals)
  console.log('  - csvResults.data.intervals.length:', csvResults?.data?.intervals?.length)
  
  if (csvResults?.data?.intervals && csvResults.data.intervals.length > 0) {
    console.log('  - Primeros 3 items de intervals:')
    csvResults.data.intervals.slice(0, 3).forEach((item: any, index: number) => {
      console.log(`    [${index}]:`, {
        separator: item.separator,
        intervalNumber: item.intervalNumber,
        journeyIndex: item.journeyIndex,
        classificationType: item.classificationType,
        isIncomplete: item.isIncomplete
      })
    })
  }
  
  // Mostrar información del resumen si está disponible
  if (csvResults?.data?.summary) {
    console.log('  - Resumen del procesamiento:')
    console.log(`    - Total trayectos: ${csvResults.data.summary.totalJourneys}`)
    console.log(`    - Trayectos incompletos: ${csvResults.data.summary.incompleteJourneys}`)
  }
  
  const availableJourneys = extractJourneysFromResults(csvResults)
  
  console.log('JourneySelector - availableJourneys:', availableJourneys)
  
  // if (availableJourneys.length === 0) {
  //   return null
  // }


  return (
    <div className="absolute top-4 right-4 z-[99999] interface-component journey-selector" style={{ zIndex: 99999 }}>
      <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-sm" style={{ zIndex: 99999, backgroundColor: 'rgba(31, 41, 55, 0.95)' }}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white font-medium">Seleccionar Trayecto</h4>
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
          
          {/* Fila separada para el botón de seleccionar todos */}
          {availableJourneys.length > 0 && (
            <div className="flex justify-end mb-3">
              {selectedJourneys.size === availableJourneys.length ? (
                <button
                  onClick={onDeselectAll}
                  className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-500 transition-colors"
                  title="Deseleccionar todos los trayectos"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Deseleccionar Todos
                </button>
              ) : (
                <button
                  onClick={onSelectAll}
                  className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-500 transition-colors"
                  title="Seleccionar todos los trayectos"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Seleccionar Todos
                </button>
              )}
            </div>
          )}
          
          <div className="space-y-2 max-h-[600px] overflow-y-auto panel-scroll">
            {availableJourneys.length > 0 ? (
              availableJourneys.map((journey) => {
              const isSelected = selectedJourneys.has(journey.index)
              const journeyColor = JOURNEY_COLORS[journey.index % JOURNEY_COLORS.length]
              
              return (
                <button
                  key={journey.index}
                  onClick={() => onToggleJourney(journey.index)}
                  className={`w-full text-left p-4 rounded-lg transition-all duration-200 border-2 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-gray-600 hover:shadow-md'
                  }`}
                >
                  {/* Header del trayecto */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full shadow-sm"
                        style={{ backgroundColor: journeyColor }}
                      />
                      <div>
                        <div className="font-semibold text-lg">
                          Trayecto {journey.index}
                        </div>
                        <div className="text-sm font-medium" style={{ color: journey.isIncomplete ? '#FB923C' : '#E5E7EB' }}>
                          {journey.endPort}
                        </div>
                      </div>
                    </div>
                    
                    {/* Badge de intervalos */}
                    <div className="bg-gray-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                      {journey.intervalCount} intervalos
                    </div>
                  </div>
                  
                  {/* Información temporal agrupada */}
                  <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Fecha</div>
                        <div className="text-sm font-medium">{journey.startDate}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Duración</div>
                        <div className="text-sm font-semibold text-blue-400">{journey.totalDuration}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Inicio</div>
                        <div className="text-sm font-medium">{journey.startTime}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Final</div>
                        <div className="text-sm font-medium">{journey.endTime}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Advertencia de gaps */}
                  {journey.hasGaps && (
                    <div className="mt-3 bg-orange-500/20 border border-orange-500/30 rounded-lg p-2">
                      <div className="flex items-center gap-2 text-orange-300 text-xs">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {journey.gapCount} gap{journey.gapCount > 1 ? 's' : ''} detectado{journey.gapCount > 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </button>
              )
              })
            ) : (
              <div className="text-center text-gray-300 py-4">
                <p className="text-sm">No hay trayectos disponibles</p>
                <p className="text-xs mt-1">Carga archivos CSV para ver los trayectos</p>
              </div>
            )}
          </div>
          
          {selectedJourneys.size > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-600">
              <div className="text-xs text-gray-300">
                Seleccionados: {selectedJourneys.size} trayecto{selectedJourneys.size > 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


