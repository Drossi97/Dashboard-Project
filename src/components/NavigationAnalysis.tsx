import React, { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
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

export function NavigationAnalysis({ results, selectedIntervals, setSelectedIntervals }: NavigationAnalysisProps) {
  const [showHelp, setShowHelp] = useState<boolean>(false)

  // Función de clasificación de intervalos (igual que LineChart.tsx)
  const classifyInterval = useCallback((
    navStatus: string,
    startPort: any | undefined,
    endPort: any | undefined
  ) => {
    // If no port data available
    if (!startPort || !endPort) {
      return {
        type: "undefined" as const,
        description: "undefined - no port data available"
      };
    }

    const samePort = startPort.name === endPort.name;
    const startDistanceDocked = startPort.distance < 4; // 4 km para atracado
    const endDistanceDocked = endPort.distance < 4;
    const startDistanceManeuvering = startPort.distance < 10; // 10 km para maniobrando
    const endDistanceManeuvering = endPort.distance < 10;
    const maxDistanceFromAnyPort = Math.max(startPort.distance, endPort.distance) > 40; // > 40 km = indefinido

    // Rule 1: Docked (atracado) - requiere estar a < 4 km del puerto
    if (navStatus === "0.0" && samePort && startDistanceDocked && endDistanceDocked) {
      return {
        type: "docked" as const,
        description: `docked at ${startPort.name}`,
        atPort: startPort.name
      };
    }

    // Rule 2: Maneuvering (maniobrando) - requiere estar a < 10 km del puerto
    if (navStatus === "1.0" && samePort && startDistanceManeuvering && endDistanceManeuvering) {
      return {
        type: "maneuvering" as const,
        description: `maneuvering at ${startPort.name}`,
        atPort: startPort.name
      };
    }

    // Rule 3: Transit (navegando)
    if (navStatus === "2.0" && !samePort) {
      return {
        type: "transit" as const,
        description: `navegando from ${startPort.name} to ${endPort.name}`,
        fromPort: startPort.name,
        toPort: endPort.name
      };
    }

    // Rule 4: Undefined (indefinido) - incluye casos donde el barco está > 40 km del puerto más cercano
    return {
      type: "undefined" as const,
      description: maxDistanceFromAnyPort
        ? "Estado indefinido - demasiado lejos de puertos (> 40 km)"
        : "Estado indefinido - condiciones no cumplidas"
    };
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
    setSelectedIntervals(results.data.intervals.map((_, index) => index))
  }, [results, setSelectedIntervals])

  const clearSelection = useCallback(() => {
    setSelectedIntervals([])
  }, [setSelectedIntervals])

  // Seleccionar por tipo de actividad
  const selectByType = useCallback((type: 'docked' | 'maneuvering' | 'transit' | 'undefined') => {
    if (!results?.data?.intervals) return
    
    const indices = results.data.intervals
      .map((interval, index) => {
        const classification = classifyInterval(interval.navStatus, interval.startPort, interval.endPort)
        return classification.type === type ? index : -1
      })
      .filter(index => index !== -1)
    
    setSelectedIntervals(indices)
  }, [results, classifyInterval, setSelectedIntervals])

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
      // Clasificar el intervalo usando la misma lógica que LineChart
      const classification = classifyInterval(interval.navStatus, interval.startPort, interval.endPort)

      let key: string
      let color: string

      if (classification.type === 'docked') {
        // Atracado en un puerto específico
        key = `Atracado_${classification.atPort}`
        color = getActivityColor('docked', classification.atPort || '')
      } else if (classification.type === 'maneuvering') {
        // Maniobrando en un puerto específico
        key = `Maniobrando_${classification.atPort}`
        color = getActivityColor('maneuvering', classification.atPort || '')
      } else if (classification.type === 'transit') {
        // Navegando entre puertos
        key = `Navegando ${classification.fromPort} → ${classification.toPort}`
        color = getActivityColor('transit', classification.fromPort || '', classification.toPort)
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
  }, [classifyInterval, getActivityColor, durationToSeconds])

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
              Análisis de navegación por intervalos
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
                <li><strong className="text-white">Selección desde el gráfico:</strong> Haz clic derecho en los intervalos del gráfico de líneas para seleccionarlos/deseleccionarlos individualmente</li>
                <li><strong className="text-white">Botones de selección rápida:</strong> Usa los botones superiores para seleccionar todos los intervalos de un tipo específico</li>
                <li><strong className="text-white">Diagrama de tarta:</strong> Visualiza las proporciones de tiempo de cada actividad en los intervalos seleccionados</li>
                <li><strong className="text-gray-400">Atracado:</strong> El barco está detenido en un puerto</li>
                <li><strong className="text-orange-400">Maniobrando:</strong> El barco está maniobrando cerca de un puerto</li>
                <li><strong className="text-green-400">Navegando:</strong> El barco está en tránsito entre puertos diferentes</li>
                <li><strong className="text-red-400">Indefinido:</strong> Estados que no cumplen las condiciones anteriores</li>
              </ul>
             </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="w-full">
            {/* Botones de selección rápida */}
            <div className="mb-6">
              <div className="flex gap-2 flex-wrap justify-center items-center">
                <button
                  onClick={selectAllIntervals}
                  className="px-3 py-1 text-sm relative group"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: '#9CA3AF'
                  }}
                >
                  Seleccionar todos
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-60 transition-opacity duration-200"></div>
                </button>
                <button
                  onClick={() => selectByType('docked')}
                  className="px-3 py-1 text-sm relative group"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: '#6B7280'
                  }}
                >
                  Solo Atracados
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gray-500 to-transparent opacity-0 group-hover:opacity-60 transition-opacity duration-200"></div>
                </button>
                <button
                  onClick={() => selectByType('maneuvering')}
                  className="px-3 py-1 text-sm relative group"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: '#F59E0B'
                  }}
                >
                  Solo Maniobrando
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-0 group-hover:opacity-60 transition-opacity duration-200"></div>
                </button>
                <button
                  onClick={() => selectByType('transit')}
                  className="px-3 py-1 text-sm relative group"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: '#10B981'
                  }}
                >
                  Solo Navegando
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-0 group-hover:opacity-60 transition-opacity duration-200"></div>
                </button>
                <button
                  onClick={() => selectByType('undefined')}
                  className="px-3 py-1 text-sm relative group"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: '#EF4444'
                  }}
                >
                  Solo Indefinidos
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-0 group-hover:opacity-60 transition-opacity duration-200"></div>
                </button>
                <button
                  onClick={clearSelection}
                  className="px-3 py-1 text-sm relative group"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: '#9CA3AF'
                  }}
                >
                  Limpiar
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-60 transition-opacity duration-200"></div>
                </button>
              </div>
            </div>

            {/* Gráfico de tarta centrado */}
            <div className="w-full flex justify-center">
              {selectedIntervalsStats ? (
                <div className="w-full max-w-3xl flex flex-col">
                  {/* Gráfico */}
                  <div className="w-full flex-shrink-0" style={{ height: '400px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={140}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Leyenda debajo */}
                  <div className="w-full mt-6">
                    {/* Total */}
                    <div className="mb-4 pb-3 border-b" style={{ borderColor: '#4B5563' }}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-lg text-white">TOTAL</span>
                        <span className="font-semibold text-lg text-white">
                          {formatDurationWithUnits(selectedIntervalsStats.totalSeconds)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {pieChartData.map((activity, index) => {
                        const totalDuration = selectedIntervalsStats.totalSeconds
                        const percentage = ((activity.value / totalDuration) * 100).toFixed(1)

                        return (
                          <div key={`${activity.activity}_${activity.port}_${index}`}
                               className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0"
                                style={{ backgroundColor: activity.color }}
                              ></div>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-base" style={{ color: activity.color }}>
                                  {activity.name}
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                              <span className="font-medium text-base" style={{ color: activity.color }}>
                                {formatDurationWithUnits(activity.value)}
                              </span>
                              <span className="text-gray-400 text-sm ml-2">{percentage}%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center text-gray-400">
                    <p className="text-xl mb-2">Selecciona intervalos para ver las estadísticas</p>
                    <p className="text-sm">Haz clic derecho en los intervalos del gráfico de líneas para seleccionarlos</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
  )
}
