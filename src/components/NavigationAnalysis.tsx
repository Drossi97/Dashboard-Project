import React, { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { ScrollArea } from "./ui/scroll-area"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { CSVAnalysisResult } from "../hooks/useCSVProcessor"

interface NavigationAnalysisProps {
  results: CSVAnalysisResult | null
  selectedIntervals: number[]
  setSelectedIntervals: React.Dispatch<React.SetStateAction<number[]>>
}

// Colores para cada tipo de actividad portuaria
const ACTIVITY_COLORS: Record<string, string> = {
  "docked_ceuta": "#6B7280",      // Gris para atracado en Ceuta
  "docked_algeciras": "#4B5563",  // Gris oscuro para atracado en Algeciras
  "docked_tangermed": "#374151",  // Gris más oscuro para atracado en TangerMed
  "maneuvering_ceuta": "#F59E0B", // Amarillo para maniobrando en Ceuta
  "maneuvering_algeciras": "#D97706", // Amarillo oscuro para maniobrando en Algeciras
  "maneuvering_tangermed": "#B45309", // Amarillo más oscuro para maniobrando en TangerMed
  "transit_ceuta_algeciras": "#10B981", // Verde para navegando Ceuta → Algeciras
  "transit_ceuta_tangermed": "#059669", // Verde oscuro para navegando Ceuta → TangerMed
  "transit_algeciras_ceuta": "#047857", // Verde más oscuro para navegando Algeciras → Ceuta
  "transit_algeciras_tangermed": "#065F46", // Verde muy oscuro para navegando Algeciras → TangerMed
  "transit_tangermed_ceuta": "#064E3B", // Verde esmeralda oscuro para navegando TangerMed → Ceuta
  "transit_tangermed_algeciras": "#0F766E", // Verde azulado para navegando TangerMed → Algeciras
  "undefined": "#EF4444", // Rojo para intervalos indefinidos
}

interface Journey {
  journeyIndex: number
  startPort: string
  endPort: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  intervalIndices: number[]
  totalDuration: number
  isIncomplete?: boolean
}

export function NavigationAnalysis({ results, selectedIntervals, setSelectedIntervals }: NavigationAnalysisProps) {
  const [showHelp, setShowHelp] = useState<boolean>(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [selectedJourneys, setSelectedJourneys] = useState<number[]>([])

  // Función auxiliar para extraer información del classificationType
  const parseClassificationType = useCallback((classificationType?: string) => {
    if (!classificationType) {
      return { type: 'undefined' as const, port: null, fromPort: null, toPort: null }
    }

    if (classificationType.startsWith('atracado - ')) {
      return { 
        type: 'docked' as const, 
        port: classificationType.replace('atracado - ', ''),
        fromPort: null,
        toPort: null
      }
    }

    if (classificationType.startsWith('maniobrando - ')) {
      return { 
        type: 'maneuvering' as const, 
        port: classificationType.replace('maniobrando - ', ''),
        fromPort: null,
        toPort: null
      }
    }

    if (classificationType.startsWith('navegando - ')) {
      const rest = classificationType.replace('navegando - ', '')
      if (rest.includes(' → ')) {
        const [from, to] = rest.split(' → ')
        return {
          type: 'transit' as const,
          port: null,
          fromPort: from,
          toPort: to
        }
      } else if (rest.startsWith('cerca de ')) {
        const port = rest.replace('cerca de ', '')
        return {
          type: 'transit' as const,
          port: port,
          fromPort: null,
          toPort: null
        }
      } else {
        // Caso de navegación sin especificar ruta (trayecto incompleto)
        return {
          type: 'transit' as const,
          port: null,
          fromPort: null,
          toPort: null
        }
      }
    }

    return { type: 'undefined' as const, port: null, fromPort: null, toPort: null }
  }, []);

  // Funciones utilitarias
  const durationToSeconds = useCallback((duration: string): number => {
    const parts = duration.split(':').map(Number)
    if (parts.length !== 3) return 0
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }, [])

  const formatDurationWithUnits = useCallback((seconds: number): string => {
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
  }, [])

  // Función para obtener el color basado en el tipo y puertos
  const getActivityColor = useCallback((type: string, startPort: string, endPort?: string): string => {
    const normalizedStartPort = startPort.toLowerCase().replace(' ', '').replace('tanger med', 'tangermed')
    const normalizedEndPort = endPort ? endPort.toLowerCase().replace(' ', '').replace('tanger med', 'tangermed') : ''

    if (type === 'docked') {
      return ACTIVITY_COLORS[`docked_${normalizedStartPort}`] || '#6B7280'
    } else if (type === 'maneuvering') {
      return ACTIVITY_COLORS[`maneuvering_${normalizedStartPort}`] || '#F59E0B'
    } else if (type === 'transit' && normalizedEndPort) {
      const transitKey = `transit_${normalizedStartPort}_${normalizedEndPort}`
      return ACTIVITY_COLORS[transitKey] || '#10B981'
    }

    return '#10B981' // Color por defecto
  }, [])

  const selectAllIntervals = useCallback(() => {
    if (!results?.data?.intervals) return
    
    // Si ya está activo, desactivar (limpiar)
    if (activeFilter === 'all') {
      setSelectedIntervals([])
      setActiveFilter(null)
      setSelectedJourneys([])
    } else {
      // Si no está activo, activar
      setSelectedIntervals(results.data.intervals.map((_, index) => index))
      setActiveFilter('all')
      setSelectedJourneys([])
    }
  }, [results, setSelectedIntervals, activeFilter])

  const clearSelection = useCallback(() => {
    setSelectedIntervals([])
    setActiveFilter(null)
    setSelectedJourneys([])
  }, [setSelectedIntervals])

  // Seleccionar por tipo de actividad (toggle)
  const selectByType = useCallback((type: 'docked' | 'maneuvering' | 'transit' | 'undefined') => {
    if (!results?.data?.intervals) return
    
    // Si ya está activo, desactivar (limpiar)
    if (activeFilter === type) {
      setSelectedIntervals([])
      setActiveFilter(null)
      setSelectedJourneys([])
    } else {
      // Si no está activo, activar
      const indices = results.data.intervals
        .map((interval, index) => {
          const parsed = parseClassificationType(interval.classificationType)
          return parsed.type === type ? index : -1
        })
        .filter(index => index !== -1)
      
      setSelectedIntervals(indices)
      setActiveFilter(type)
      setSelectedJourneys([])
    }
  }, [results, parseClassificationType, setSelectedIntervals, activeFilter])


  // Función auxiliar para formatear fecha corta
  const formatDateShort = useCallback((dateString: string): string => {
    const parts = dateString.split('-')
    if (parts.length !== 3) return dateString
    const [year, month, day] = parts
    return `${day}/${month}`
  }, [])

  // Función auxiliar para formatear hora corta (sin segundos)
  const formatTimeShort = useCallback((timeString: string): string => {
    const parts = timeString.split(':')
    if (parts.length !== 3) return timeString
    return `${parts[0]}:${parts[1]}`
  }, [])

  // Obtener trayectos desde el JSON (solo los que tienen journeyIndex asignado)
  const journeys = useMemo(() => {
    if (!results?.data?.intervals) return []

    // Crear un mapa para agrupar intervalos por journeyIndex
    const journeyMap = new Map<number, {
      intervalIndices: number[]
      intervals: any[]
    }>()

    // Solo procesar intervalos que tienen journeyIndex asignado
    results.data.intervals.forEach((interval, index) => {
      const jIndex = interval.journeyIndex
      // Solo incluir intervalos que efectivamente tienen un journeyIndex válido
      if (jIndex !== null && jIndex !== undefined && jIndex >= 0) {
        if (!journeyMap.has(jIndex)) {
          journeyMap.set(jIndex, { intervalIndices: [], intervals: [] })
        }
        journeyMap.get(jIndex)!.intervalIndices.push(index)
        journeyMap.get(jIndex)!.intervals.push(interval)
      }
    })

    // Convertir a array de Journey ordenados por journeyIndex
    return Array.from(journeyMap.entries())
      .sort((a, b) => a[0] - b[0]) // Ordenar por journeyIndex
      .map(([jIndex, data]) => {
        const firstInterval = data.intervals[0]
        const lastInterval = data.intervals[data.intervals.length - 1]

        // Obtener puertos de inicio y fin desde la clasificación
        const firstParsed = parseClassificationType(firstInterval.classificationType)
        const lastParsed = parseClassificationType(lastInterval.classificationType)

        // Determinar puertos de manera más robusta
        let startPort = firstParsed.port || firstParsed.fromPort || '?'
        let endPort = lastParsed.port || lastParsed.toPort || '?'

        // Si no se pudo determinar desde clasificación, usar puertos de coordenadas
        if (startPort === '?') {
          startPort = firstInterval.startPort?.name || 'Desconocido'
        }
        if (endPort === '?') {
          // Usar el puerto detectado por coordenadas
          endPort = lastInterval.endPort?.name || 'Desconocido'

          // Si sigue siendo desconocido y es navegación, podría ser un trayecto incompleto
          if (endPort === 'Desconocido' && lastInterval.navStatus === '2.0') {
            endPort = 'Destino pendiente'
          }
        }

        // Calcular duración total
      let totalSeconds = 0
        data.intervals.forEach(interval => {
        totalSeconds += durationToSeconds(interval.duration)
      })

        // Determinar si el trayecto está incompleto
        // Solo es incompleto si termina en navegación (2.0), no en maniobra (1.0)
        // porque la maniobra es parte del proceso normal de llegada
        const isIncomplete = lastInterval.navStatus === '2.0'

        return {
          journeyIndex: jIndex,
          startPort,
          endPort,
          startDate: firstInterval.startDate,
          startTime: firstInterval.startTime,
          endDate: lastInterval.endDate,
          endTime: lastInterval.endTime,
          intervalIndices: data.intervalIndices,
          totalDuration: totalSeconds,
          isIncomplete // Nueva propiedad para indicar trayecto incompleto
        }
      })
  }, [results?.data?.intervals, parseClassificationType, durationToSeconds])

  // Seleccionar/deseleccionar trayecto (permite múltiple selección)
  const selectJourney = useCallback((journeyIndex: number) => {
    const journey = journeys[journeyIndex]
    if (!journey) return
    
    setSelectedJourneys(prev => {
      let newSelectedJourneys: number[]
      
      if (prev.includes(journeyIndex)) {
        // Si ya está seleccionado, lo deseleccionamos
        newSelectedJourneys = prev.filter(idx => idx !== journeyIndex)
      } else {
        // Si no está seleccionado, lo agregamos
        newSelectedJourneys = [...prev, journeyIndex].sort((a, b) => a - b)
      }
      
      // Combinar todos los intervalos de los trayectos seleccionados
      const allIntervalIndices = new Set<number>()
      newSelectedJourneys.forEach(jIdx => {
        const j = journeys[jIdx]
        if (j) {
          j.intervalIndices.forEach(intervalIdx => allIntervalIndices.add(intervalIdx))
        }
      })
      
      setSelectedIntervals(Array.from(allIntervalIndices).sort((a, b) => a - b))
      setActiveFilter(null)
      
      return newSelectedJourneys
    })
  }, [journeys, setSelectedIntervals])

  // Calcular estadísticas de intervalos seleccionados
  const selectedIntervalsStats = useMemo(() => {
    if (!results?.data?.intervals || selectedIntervals.length === 0) {
      return null
    }

    const intervals = results.data.intervals
    const selected = selectedIntervals.map(index => intervals[index])

      let totalSeconds = 0
    selected.forEach(interval => {
        totalSeconds += durationToSeconds(interval.duration)
      })

    return {
      count: selected.length,
        totalSeconds: totalSeconds,
      intervals: selected
    }
  }, [results, selectedIntervals, durationToSeconds])


  // Función para obtener datos para el gráfico de tarta de intervalos seleccionados
  const getPieChartData = useCallback((intervals: any[]) => {
    const activityGroups: { [key: string]: { duration: number; count: number; color: string } } = {}

    intervals.forEach(interval => {
      // Usar el classificationType que ya viene del JSON
      const parsed = parseClassificationType(interval.classificationType)

      let key: string
      let color: string

      if (parsed.type === 'docked' && parsed.port) {
        // Atracado en un puerto específico
        key = `Atracado_${parsed.port}`
        color = getActivityColor('docked', parsed.port)
      } else if (parsed.type === 'maneuvering' && parsed.port) {
        // Maniobrando en un puerto específico
        key = `Maniobrando_${parsed.port}`
        color = getActivityColor('maneuvering', parsed.port)
      } else if (parsed.type === 'transit' && parsed.fromPort && parsed.toPort) {
        // Navegando entre puertos
        key = `Navegando ${parsed.fromPort} → ${parsed.toPort}`
        color = getActivityColor('transit', parsed.fromPort, parsed.toPort)
      } else if (parsed.type === 'transit' && parsed.port) {
        // Navegando cerca de un puerto
        key = `Navegando cerca de ${parsed.port}`
        color = getActivityColor('transit', parsed.port)
      } else {
        // Estado indefinido
        key = 'Indefinido'
        color = ACTIVITY_COLORS['undefined']
      }

        if (!activityGroups[key]) {
          activityGroups[key] = {
            duration: 0,
            count: 0,
          color: color
          }
        }

        activityGroups[key].duration += durationToSeconds(interval.duration)
        activityGroups[key].count += 1
    })

    return Object.entries(activityGroups).map(([key, data]) => {
      if (key.includes('_')) {
        const [activityName, portName] = key.split('_')
        return {
          name: `${activityName} en ${portName}`,
          value: data.duration,
          color: data.color,
          count: data.count,
          activity: activityName,
          port: portName
        }
      } else {
        return {
          name: key,
          value: data.duration,
          color: data.color,
          count: data.count,
          activity: key,
          port: ''
        }
      }
    }).sort((a, b) => b.value - a.value)
  }, [parseClassificationType, getActivityColor, durationToSeconds])

  // Memoizar los datos del gráfico de intervalos seleccionados
  const pieChartData = useMemo(() => {
    if (!selectedIntervalsStats) return []
    return getPieChartData(selectedIntervalsStats.intervals)
  }, [selectedIntervalsStats, getPieChartData])

  // Early returns después de todos los hooks
  if (!results || !results.success || !results.data) {
    return null
  }

  if (!results.data.intervals || results.data.intervals.length === 0) {
    return null
  }

  return (
    <Card style={{ backgroundColor: '#171717', borderColor: '#2C2C2C' }} data-component="navigation-analysis">
         <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
               <CardTitle className="text-white text-lg font-semibold">
              Análisis de navegación por intervalos (en pruebas)
               </CardTitle>
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
              <h4 className="text-white font-semibold mb-2">ℹ️ Cómo usar el análisis por intervalos</h4>
              <ul className="text-gray-300 space-y-2 text-xs">
                <li><strong className="text-cyan-400">Trayectos (izquierda):</strong> Los trayectos se generan automáticamente agrupando intervalos relacionados. Cada trayecto tiene un número único (journeyIndex) y muestra el origen y destino detectados desde los datos procesados</li>
                <li><strong className="text-yellow-400">Trayectos incompletos:</strong> Se marcan con una etiqueta amarilla cuando terminan en navegación (estado 2.0) sin llegar a atracar en el destino</li>
                <li><strong className="text-white">Selección desde el gráfico:</strong> Haz clic derecho en los intervalos del gráfico de líneas para seleccionarlos/deseleccionarlos individualmente</li>
                <li><strong className="text-white">Botones de la derecha:</strong> Usa los botones de la columna derecha para filtrar rápidamente intervalos por tipo de actividad</li>
                <li><strong className="text-white">Diagrama de tarta:</strong> Visualiza las proporciones de tiempo de cada actividad en los intervalos seleccionados</li>
                <li><strong className="text-gray-400">Atracado:</strong> El barco está detenido en un puerto (&lt; 4km)</li>
                <li><strong className="text-orange-400">Maniobrando:</strong> El barco está maniobrando cerca de un puerto (&lt; 10km) - parte del proceso de llegada</li>
                <li><strong className="text-green-400">Navegando:</strong> El barco está en tránsito entre puertos diferentes</li>
                <li><strong className="text-red-400">Indefinido:</strong> Estados que no cumplen las condiciones anteriores</li>
              </ul>
             </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            {/* Columna izquierda: Lista de trayectos */}
            <div className="w-72 flex-shrink-0">
              <h3 className="text-white font-semibold text-sm mb-3">
                Trayectos detectados ({journeys.length})
                {results?.data?.intervals && (
                  <>
                    <span className="text-xs text-gray-400 ml-2">
                      de {results.data.intervals.filter(i => i.journeyIndex !== null && i.journeyIndex !== undefined).length} intervalos asignados
                    </span>
                    {journeys.some(j => j.isIncomplete) && (
                      <span className="text-xs text-yellow-400 ml-2">
                        ({journeys.filter(j => j.isIncomplete).length} incompletos)
                      </span>
                    )}
                  </>
                )}
              </h3>
              <ScrollArea style={{ height: '600px' }}>
                <div className="flex flex-col gap-2 pr-3">
                  {journeys.map((journey) => {
                    const isSelected = selectedJourneys.includes(journey.journeyIndex)
                    
                    return (
                      <button
                        key={journey.journeyIndex}
                        onClick={() => selectJourney(journey.journeyIndex)}
                        className="px-4 py-3 text-left rounded-lg transition-all hover:bg-gray-700"
                          style={{
                          backgroundColor: isSelected ? '#374151' : '#2C2C2C',
                          border: 'none'
                        }}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold" style={{ color: isSelected ? '#6EE7B7' : '#10B981' }}>
                              {journey.startPort} → {journey.endPort}
                            </div>
                            {journey.isIncomplete && (
                              <span className="text-xs px-2 py-1 rounded-full bg-yellow-900 text-yellow-200 border border-yellow-600">
                                Incompleto
                              </span>
                            )}
                    </div>
                        <div className="text-xs text-gray-400">
                          {formatDateShort(journey.startDate)}
                  </div>
                        <div className="text-xs text-gray-400">
                          {formatTimeShort(journey.startTime)} - {formatTimeShort(journey.endTime)}
                            </div>
                        <div className="text-xs text-gray-300">
                          Duración: {formatDurationWithUnits(journey.totalDuration)}
                          </div>
                        <div className="text-xs text-gray-500">
                          {journey.intervalIndices.length} intervalos
                            </div>
                          </div>
                    </button>
                    )
                  })}
                  {journeys.length === 0 && (
                    <div className="text-center text-gray-400 py-8 text-sm">
                      No se detectaron trayectos completos
                        </div>
                  )}
                            </div>
                          </ScrollArea>
                        </div>

            {/* Columna centro: Gráfico de tarta */}
            <div className="flex-1 min-w-0">
              <div className="w-full flex flex-col">
                {/* Gráfico */}
                <div className="w-full flex-shrink-0" style={{ height: '350px' }}>
                  {selectedIntervalsStats ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieChartData}
                                cx="50%"
                                cy="50%"
                          outerRadius={120}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {pieChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-400">
                        <p className="text-lg mb-2">Selecciona <span className="text-white font-semibold">intervalos</span></p>
                        <p className="text-xs"><span className="text-white font-semibold">Clic derecho</span> en el gráfico o usa los filtros</p>
                        </div>
                      </div>
                  )}
                </div>

                {/* Leyenda debajo */}
                <div className="w-full mt-4" style={{ minHeight: '200px' }}>
                  {selectedIntervalsStats ? (
                    <>
                      {/* Total */}
                      <div className="mb-3 pb-2 border-b" style={{ borderColor: '#4B5563' }}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-base text-white">TOTAL</span>
                          <span className="font-semibold text-base text-white">
                            {formatDurationWithUnits(selectedIntervalsStats.totalSeconds)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                              {pieChartData.map((activity, index) => {
                          const totalDuration = selectedIntervalsStats.totalSeconds
                          const percentage = ((activity.value / totalDuration) * 100).toFixed(1)

                          return (
                                  <div key={`${activity.activity}_${activity.port}_${index}`}
                                 className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: activity.color }}
                                ></div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium text-sm" style={{ color: activity.color }}>
                                    {activity.name}
                                  </span>
                                  </div>
                                </div>
                              <div className="text-right flex-shrink-0 ml-2">
                                <span className="font-medium text-sm" style={{ color: activity.color }}>
                                  {formatDurationWithUnits(activity.value)}
                                </span>
                                <span className="text-gray-400 text-xs ml-2">{percentage}%</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-400">
                        <p className="text-xs">Los resultados aparecerán aquí</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
                  </div>

            {/* Columna derecha: Botones de selección */}
            <div className="w-56 flex-shrink-0">
              <h3 className="text-white font-semibold text-sm mb-3">Filtros rápidos</h3>
              <div className="flex flex-col gap-2.5">
                {/* Botón: Seleccionar todos */}
                <button
                  onClick={selectAllIntervals}
                  className="px-4 py-3 text-sm text-left rounded-lg transition-all hover:bg-gray-700"
                  style={{
                    backgroundColor: activeFilter === 'all' ? '#374151' : '#2C2C2C',
                    border: 'none',
                    color: activeFilter === 'all' ? '#FFFFFF' : '#9CA3AF',
                    fontWeight: activeFilter === 'all' ? '600' : '400'
                  }}
                >
                  Seleccionar todos
                </button>
                
                {/* Botón: Solo Atracados */}
                <button
                  onClick={() => selectByType('docked')}
                  className="px-4 py-3 text-sm text-left rounded-lg transition-all hover:bg-gray-700"
                  style={{
                    backgroundColor: activeFilter === 'docked' ? '#374151' : '#2C2C2C',
                    border: 'none',
                    color: activeFilter === 'docked' ? '#9CA3AF' : '#6B7280',
                    fontWeight: activeFilter === 'docked' ? '600' : '400'
                  }}
                >
                  Solo Atracados
                </button>
                
                {/* Botón: Solo Maniobrando */}
                <button
                  onClick={() => selectByType('maneuvering')}
                  className="px-4 py-3 text-sm text-left rounded-lg transition-all hover:bg-gray-700"
                  style={{
                    backgroundColor: activeFilter === 'maneuvering' ? '#374151' : '#2C2C2C',
                    border: 'none',
                    color: activeFilter === 'maneuvering' ? '#FCD34D' : '#F59E0B',
                    fontWeight: activeFilter === 'maneuvering' ? '600' : '400'
                  }}
                >
                  Solo Maniobrando
                </button>
                
                {/* Botón: Solo Navegando */}
                <button
                  onClick={() => selectByType('transit')}
                  className="px-4 py-3 text-sm text-left rounded-lg transition-all hover:bg-gray-700"
                  style={{
                    backgroundColor: activeFilter === 'transit' ? '#374151' : '#2C2C2C',
                    border: 'none',
                    color: activeFilter === 'transit' ? '#6EE7B7' : '#10B981',
                    fontWeight: activeFilter === 'transit' ? '600' : '400'
                  }}
                >
                  Solo Navegando
                </button>
                
                {/* Botón: Solo Indefinidos */}
                <button
                  onClick={() => selectByType('undefined')}
                  className="px-4 py-3 text-sm text-left rounded-lg transition-all hover:bg-gray-700"
                  style={{
                    backgroundColor: activeFilter === 'undefined' ? '#374151' : '#2C2C2C',
                    border: 'none',
                    color: activeFilter === 'undefined' ? '#FCA5A5' : '#EF4444',
                    fontWeight: activeFilter === 'undefined' ? '600' : '400'
                  }}
                >
                  Solo Indefinidos
                </button>

                {/* Separador */}
                <div className="my-2 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>

                {/* Botón: Limpiar */}
                <button
                  onClick={clearSelection}
                  className="px-4 py-3 text-sm text-left rounded-lg transition-all hover:bg-gray-700"
                  style={{
                    backgroundColor: '#2C2C2C',
                    border: 'none',
                    color: '#9CA3AF'
                  }}
                >
                  🗑️ Limpiar
                </button>
                  </div>
                </div>
              </div>
        </CardContent>
      </Card>
  )
}
