import React, { useState, useMemo, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { CSVAnalysisResult } from "../hooks/useCSVProcessor"

interface NavigationAnalysisProps {
  results: CSVAnalysisResult | null
}

interface RouteSegment {
  id: string
  startPort: string
  endPort: string
  startTime: string
  endTime: string
  totalDuration: string
  totalSeconds: number
  intervals: any[]
  avgSpeed: number | null
  distance: number
  type: 'complete' | 'incomplete'
}

interface PortActivity {
  id: string
  name: string
  duration: number
  type: 'docked' | 'maneuvering' | 'transit' | 'undefined'
  port: string
  color: string
}

// Colores para cada tipo de actividad portuaria
const ACTIVITY_COLORS: Record<string, string> = {
  "docked_ceuta": "#6B7280",      // Gris para atracado en Ceuta
  "docked_algeciras": "#4B5563",  // Gris oscuro para atracado en Algeciras
  "docked_tangermed": "#374151",  // Gris más oscuro para atracado en TangerMed
  "maneuvering_ceuta": "#F59E0B", // Amarillo para maniobrando en Ceuta
  "maneuvering_algeciras": "#D97706", // Amarillo oscuro para maniobrando en Algeciras
  "maneuvering_tangermed": "#B45309", // Amarillo más oscuro para maniobrando en TangerMed
  "transit_ceuta_algeciras": "#10B981", // Verde para tránsito Ceuta → Algeciras
  "transit_ceuta_tangermed": "#059669", // Verde oscuro para tránsito Ceuta → TangerMed
  "transit_algeciras_ceuta": "#047857", // Verde más oscuro para tránsito Algeciras → Ceuta
  "transit_algeciras_tangermed": "#065F46", // Verde muy oscuro para tránsito Algeciras → TangerMed
  "transit_tangermed_ceuta": "#064E3B", // Verde esmeralda oscuro para tránsito TangerMed → Ceuta
  "transit_tangermed_algeciras": "#0F766E", // Verde azulado para tránsito TangerMed → Algeciras
  "undefined": "#EF4444", // Rojo para intervalos indefinidos
}

export function NavigationAnalysis({ results }: NavigationAnalysisProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'routes' | 'activities'>('routes')

  // Funciones utilitarias
  const durationToSeconds = useCallback((duration: string): number => {
    const parts = duration.split(':').map(Number)
    if (parts.length !== 3) return 0
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }, [])

  const secondsToDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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

  // Función para extraer solo la fecha en formato DD/MM/YYYY
  const formatDateOnly = useCallback((dateTimeString: string): string => {
    const dateString = dateTimeString.split(' ')[0]
    const parts = dateString.split('-')
    if (parts.length !== 3) return dateString
    const [year, month, day] = parts
    return `${day}/${month}/${year}`
  }, [])

  // Función para extraer y formatear la hora en formato HH:MM:SS (sin decimales)
  const formatTimeOnly = useCallback((dateTimeString: string): string => {
    const timeString = dateTimeString.split(' ')[1]
    if (!timeString) return '--:--:--'
    
    const parts = timeString.split(':')
    if (parts.length !== 3) return timeString
    
    const hours = parts[0].padStart(2, '0')
    const minutes = parts[1].padStart(2, '0')
    const seconds = Math.floor(parseFloat(parts[2])).toString().padStart(2, '0')
    
    return `${hours}:${minutes}:${seconds}`
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

  // Calcular rutas completas
  const routesData = useMemo(() => {
    // Early return si no hay datos
    if (!results || !results.success || !results.data) {
      return []
    }
    
    const routes: RouteSegment[] = []
    const intervals = results.data?.intervals || []

    if (intervals.length < 3) return routes

    let currentRoute: any = null
    let routeStartIndex = 0

    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i]
      const prevInterval = i > 0 ? intervals[i - 1] : null
      const nextInterval = i < intervals.length - 1 ? intervals[i + 1] : null

      if (interval.navStatus === "0.0" && prevInterval &&
          (prevInterval.navStatus === "1.0" || prevInterval.navStatus === "2.0") &&
          interval.startPort && interval.endPort &&
          interval.startPort.name === interval.endPort.name) {

        if (currentRoute) {
          completeRoute(currentRoute, routeStartIndex, i - 1)
        }

        currentRoute = {
          startPort: interval.startPort.name,
          startTime: interval.startTime,
          startDate: interval.startDate,
          intervals: []
        }
        routeStartIndex = i
      }

      if (currentRoute) {
        currentRoute.intervals.push(interval)

        if (interval.navStatus === "0.0" &&
            nextInterval &&
            (nextInterval.navStatus === "1.0" || nextInterval.navStatus === "2.0") &&
            interval.startPort && interval.endPort &&
            interval.startPort.name !== interval.endPort.name) {

          completeRoute(currentRoute, routeStartIndex, i)
          currentRoute = null
        }
      }
    }

    if (currentRoute) {
      completeRoute(currentRoute, routeStartIndex, intervals.length - 1)
    }

    return routes

    function completeRoute(route: any, startIndex: number, endIndex: number) {
      if (route.intervals.length === 0) return

      const startInterval = route.intervals[0]
      const endInterval = route.intervals[route.intervals.length - 1]

      let totalSeconds = 0
      route.intervals.forEach((interval: any) => {
        totalSeconds += durationToSeconds(interval.duration)
      })

      const validSpeeds = route.intervals
        .map((interval: any) => interval.avgSpeed)
        .filter((speed: number | null) => speed !== null && speed > 0)

      const avgSpeed = validSpeeds.length > 0
        ? Math.round((validSpeeds.reduce((a: number, b: number) => a + b, 0) / validSpeeds.length) * 100) / 100
        : null

      let endPort = startInterval.startPort?.name || 'Desconocido'
      for (let i = route.intervals.length - 1; i >= 0; i--) {
        const interval = route.intervals[i]
        if (interval.endPort && interval.endPort.name !== startInterval.startPort?.name) {
          endPort = interval.endPort.name
          break
        }
      }

      let distance = 0
      if (startInterval.startLat && startInterval.startLon && endInterval.endLat && endInterval.endLon) {
        const R = 6371
        const dLat = (endInterval.endLat - startInterval.startLat) * (Math.PI / 180)
        const dLon = (endInterval.endLon - startInterval.startLon) * (Math.PI / 180)

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(startInterval.startLat * (Math.PI / 180)) * Math.cos(endInterval.endLat * (Math.PI / 180)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2)

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        distance = Math.round(R * c * 100) / 100
      }

      routes.push({
        id: `route_${routes.length + 1}`,
        startPort: startInterval.startPort?.name || 'Desconocido',
        endPort: endPort,
        startTime: `${startInterval.startDate} ${startInterval.startTime}`,
        endTime: `${endInterval.endDate} ${endInterval.endTime}`,
        totalDuration: secondsToDuration(totalSeconds),
        totalSeconds: totalSeconds,
        intervals: route.intervals,
        avgSpeed: avgSpeed,
        distance: distance,
        type: 'complete'
      })
    }
  }, [results, durationToSeconds, secondsToDuration])

  // Procesar actividades portuarias
  const portActivities = useMemo(() => {
    if (!results || !results.success || !results.data) {
      return []
    }

    return results.data.intervals.reduce((acc: PortActivity[], interval) => {
      const durationSeconds = durationToSeconds(interval.duration)

      if (!interval.startPort || !interval.endPort) {
        return acc
      }

      const startPort = interval.startPort.name
      const endPort = interval.endPort.name
      const navStatus = interval.navStatus

      // Determinar el tipo de actividad basado en navStatus y puertos
      const startDistanceDocked = interval.startPort.distance < 4; // 4 km para atracado
      const endDistanceDocked = interval.endPort.distance < 4;
      const startDistanceManeuvering = interval.startPort.distance < 10; // 10 km para maniobrando
      const endDistanceManeuvering = interval.endPort.distance < 10;
      const maxDistanceFromAnyPort = Math.max(interval.startPort.distance, interval.endPort.distance) > 40; // > 40 km = indefinido

      // Rule 1: Docked (atracado) - requiere estar a < 4 km del puerto
      if (navStatus === "0.0" && startPort === endPort && startDistanceDocked && endDistanceDocked) {
        // Atracado en un puerto específico
        const activityId = `docked_${startPort.toLowerCase().replace(' ', '').replace('tanger med', 'tangermed')}`
        acc.push({
          id: activityId,
          name: `Atracado en ${startPort}`,
          duration: durationSeconds,
          type: 'docked',
          port: startPort,
          color: getActivityColor('docked', startPort)
        })
      // Rule 2: Maneuvering (maniobrando) - requiere estar a < 10 km del puerto
      } else if (navStatus === "1.0" && startPort === endPort && startDistanceManeuvering && endDistanceManeuvering) {
        // Maniobrando en un puerto específico
        const activityId = `maneuvering_${startPort.toLowerCase().replace(' ', '').replace('tanger med', 'tangermed')}`
        acc.push({
          id: activityId,
          name: `Maniobrando en ${startPort}`,
          duration: durationSeconds,
          type: 'maneuvering',
          port: startPort,
          color: getActivityColor('maneuvering', startPort)
        })
      } else if (navStatus === "2.0" && startPort !== endPort) {
        // Navegando desde un puerto hacia otro
        const routeId = `${startPort.toLowerCase().replace(' ', '').replace('tanger med', 'tangermed')}_${endPort.toLowerCase().replace(' ', '').replace('tanger med', 'tangermed')}`
        const transitActivityId = `transit_${routeId}`
        acc.push({
          id: transitActivityId,
          name: `Navegando ${startPort} → ${endPort}`,
          duration: durationSeconds,
          type: 'transit',
          port: `${startPort} → ${endPort}`,
          color: getActivityColor('transit', startPort, endPort)
        })
      } else {
        // Intervalos indefinidos (no cumplen ninguna condición específica o están > 40 km del puerto más cercano)
        acc.push({
          id: 'undefined',
          name: maxDistanceFromAnyPort ? 'Estado indefinido' : 'Indefinido',
          duration: durationSeconds,
          type: 'undefined',
          port: maxDistanceFromAnyPort ? 'Estado indefinido' : 'Desconocido',
          color: ACTIVITY_COLORS['undefined']
        })
      }

      return acc
    }, [])
  }, [results, durationToSeconds, getActivityColor])

  // Agrupar actividades por tipo
  const activityGroups = useMemo(() => {
    return portActivities.reduce((acc: any, activity) => {
      if (!acc[activity.id]) {
        acc[activity.id] = {
          id: activity.id,
          name: activity.name,
          duration: 0,
          type: activity.type,
          port: activity.port,
          color: activity.color,
          count: 0
        }
      }

      acc[activity.id].duration += activity.duration
      acc[activity.id].count++

      return acc
    }, {})
  }, [portActivities])

  // Convertir actividades a formato para el gráfico
  const chartData = useMemo(() => {
    return Object.values(activityGroups)
      .map((group: any) => ({
        id: group.id,
        name: group.name,
        value: group.duration,
        type: group.type,
        port: group.port,
        color: group.color
      }))
      .sort((a: any, b: any) => b.value - a.value) // Ordenar por duración descendente
  }, [activityGroups])

  // Obtener el trayecto seleccionado
  const selectedRoute = useMemo(() =>
    selectedRouteId ? routesData.find(route => route.id === selectedRouteId) : null,
    [selectedRouteId, routesData]
  )

  // Auto-seleccionar el primer trayecto
  useEffect(() => {
    if (routesData.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routesData[0].id)
    }
  }, [routesData, selectedRouteId])

  // Función para obtener datos para el gráfico de tarta de rutas (memoizada)
  const getPieChartData = useCallback((intervals: any[]) => {
    const activityGroups: { [key: string]: { duration: number; count: number; color: string } } = {}

    intervals.forEach(interval => {
      const status = interval.navStatus
      const statusName = getStatusName(status)

      // Para navegación, no especificar puerto ya que es en tránsito
      if (status === "2.0") {
        const key = statusName

        if (!activityGroups[key]) {
          activityGroups[key] = {
            duration: 0,
            count: 0,
            color: getActivityColor('transit', '', '')
          }
        }

        activityGroups[key].duration += durationToSeconds(interval.duration)
        activityGroups[key].count += 1
      } else {
        // Para atracado y maniobrando, especificar el puerto
        const port = interval.startPort?.name || interval.endPort?.name || 'Desconocido'
        const key = `${statusName}_${port}`

        if (!activityGroups[key]) {
          const activityType = status === "0.0" ? 'docked' : 'maneuvering'
          activityGroups[key] = {
            duration: 0,
            count: 0,
            color: getActivityColor(activityType, port)
          }
        }

        activityGroups[key].duration += durationToSeconds(interval.duration)
        activityGroups[key].count += 1
      }
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
  }, [getActivityColor, durationToSeconds])

  // Función para obtener el nombre del estado de navegación (memoizada)
  const getStatusName = useCallback((navStatus: string): string => {
    switch (navStatus) {
      case "0.0": return "Atracado"
      case "1.0": return "Maniobrando"
      case "2.0": return "Navegando"
      default: return "Indefinido"
    }
  }, [])

  // Memoizar los datos del gráfico para evitar recálculos innecesarios
  const pieChartData = useMemo(() => {
    if (!selectedRoute) return []
    return getPieChartData(selectedRoute.intervals)
  }, [selectedRoute, getPieChartData])

  // Tooltip personalizado para el gráfico (memoizado)
  const CustomTooltip = useCallback(({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const totalDuration = activeTab === 'routes' && selectedRoute 
        ? selectedRoute.totalSeconds 
        : chartData.reduce((sum, item) => sum + item.value, 0)
      const percentage = ((data.value / totalDuration) * 100).toFixed(1)

      return (
        <div className="p-3 rounded-lg shadow-lg" style={{ backgroundColor: '#2C2C2C', border: '1px solid #4B5563' }}>
          <p className="text-white font-medium">{data.name}</p>
          <p className="text-gray-300">
            {formatDurationWithUnits(data.value)} ({percentage}%)
          </p>
          <p className="text-gray-400 text-sm">
            {data.count} intervalo{data.count !== 1 ? 's' : ''}
          </p>
        </div>
      )
    }
    return null
  }, [selectedRoute, activeTab, chartData, formatDurationWithUnits])

  // Early returns después de todos los hooks
  if (!results || !results.success || !results.data) {
    return null
  }

  if (routesData.length === 0 && chartData.length === 0) {
    return null
  }

  return (
    <Card style={{ backgroundColor: '#171717', borderColor: '#2C2C2C' }}>
         <CardHeader className="pb-2">
           <div className="flex flex-col gap-2">
             {/* Fila del título */}
             <div className="flex justify-start">
               <CardTitle className="text-white text-lg font-semibold">
                 Análisis de navegación (Aún en pruebas)
               </CardTitle>
             </div>
             {/* Fila de los botones */}
             <div className="flex justify-center">
               <div className="flex gap-1">
                <Button
                  variant={activeTab === 'activities' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab('activities')}
                  className="text-sm px-4 py-2 h-9 relative"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: '#D1D5DB',
                    fontSize: '14px'
                  }}
                >
                  Estadísticas de navegación completa
                  {activeTab === 'activities' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-60"></div>
                  )}
                </Button>
                <Button
                  variant={activeTab === 'routes' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab('routes')}
                  className="text-sm px-4 py-2 h-9 relative"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    color: '#D1D5DB',
                    fontSize: '14px'
                  }}
                >
                  Estadísticas de navegación por trayectos
                  {activeTab === 'routes' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-60"></div>
                  )}
                </Button>
               </div>
             </div>
           </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'routes' ? (
            <>
              {/* Vista de Trayectos */}
              {routesData.length > 0 && (
                <div className="w-full">
                  {/* Selector de trayectos */}
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <span className="text-gray-400 text-base">Trayecto:</span>
                    <div className="flex gap-2">
                      {routesData.map((route, index) => (
                        <Button
                          key={route.id}
                          variant={selectedRouteId === route.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedRouteId(route.id)}
                          className="text-sm px-3 py-2 h-9 relative"
                          style={{
                            backgroundColor: 'transparent',
                            borderColor: 'transparent',
                            color: '#D1D5DB',
                            fontSize: '14px'
                          }}
                        >
                          {index + 1}
                          {selectedRouteId === route.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-60"></div>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {selectedRoute && (
                    <>
                      {/* Información del trayecto principal */}
                      <div className="mb-4">
                        <div className="p-4 rounded-md w-full"
                             style={{ backgroundColor: '#2C2C2C' }}>
                          {/* Trayecto centrado arriba */}
                          <div className="text-center mb-4">
                            <div className="text-white font-medium text-xl">
                              {selectedRoute.startPort} → {selectedRoute.endPort}
                            </div>
                          </div>

                          {/* Separador */}
                          <div className="border-t border-gray-600 mb-4"></div>

                          {/* Información de tiempo, fecha y duración abajo */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
                            {/* Fecha */}
                            <div>
                              <div className="text-gray-400 text-sm mb-1">Fecha</div>
                              <div className="text-white font-medium text-base">{formatDateOnly(selectedRoute.startTime)}</div>
                            </div>

                            {/* Hora de inicio */}
                            <div>
                              <div className="text-gray-400 text-sm mb-1">Hora de inicio</div>
                              <div className="text-white font-medium text-base">{formatTimeOnly(selectedRoute.startTime)}</div>
                            </div>

                            {/* Hora de fin */}
                            <div>
                              <div className="text-gray-400 text-sm mb-1">Hora de fin</div>
                              <div className="text-white font-medium text-base">{formatTimeOnly(selectedRoute.endTime)}</div>
                            </div>

                            {/* Duración */}
                            <div>
                              <div className="text-gray-400 text-sm mb-1">Duración</div>
                              <div className="text-white font-medium text-base">{formatDurationWithUnits(selectedRoute.totalSeconds)}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Layout horizontal para actividades y gráfico */}
                      <div className="flex flex-col lg:flex-row gap-4">
                        {/* Actividades del trayecto */}
                        <div className="w-full lg:w-1/2">
                          <ScrollArea className="h-[350px] w-full">
                            <div className="grid grid-cols-1 gap-1 pr-4">
                              {pieChartData.map((activity, index) => {
                                const totalDuration = selectedRoute.totalSeconds
                                const percentage = ((activity.value / totalDuration) * 100).toFixed(1)

                                return (
                                  <div key={`${activity.activity}_${activity.port}_${index}`}
                                       className="p-3 rounded-md flex items-center justify-between w-full"
                                       style={{ backgroundColor: '#2C2C2C' }}>
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                      <div
                                        className="w-5 h-5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: activity.color }}
                                      ></div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-white font-medium text-base">{activity.name}</div>
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                      <div className="text-gray-300 font-medium text-base">{formatDurationWithUnits(activity.value)}</div>
                                      <div className="text-gray-400 text-sm">{percentage}%</div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </ScrollArea>
                        </div>

                        {/* Gráfico de tarta para el trayecto */}
                        <div className="w-full lg:w-1/2" style={{ height: '350px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieChartData}
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {pieChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Vista de Actividades */}
              <div className="w-full">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Leyenda y estadísticas */}
                  <div className="w-full lg:w-1/2">
                    <ScrollArea className="h-[350px] w-full">
                      <div className="grid grid-cols-1 gap-1 pr-4">
                        {chartData.map((activity, index) => {
                          const totalDuration = chartData.reduce((sum, item) => sum + item.value, 0)
                          const percentage = ((activity.value / totalDuration) * 100).toFixed(1)

                          return (
                            <div key={activity.id}
                                 className="p-3 rounded-md flex items-center justify-between w-full"
                                 style={{ backgroundColor: '#2C2C2C' }}>
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div
                                  className="w-5 h-5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: activity.color }}
                                ></div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-white font-medium text-base">{activity.port}</div>
                                  <div className="text-gray-400 text-sm">
                                    {activity.type === 'docked' ? 'Atracado' :
                                     activity.type === 'maneuvering' ? 'Maniobrando' :
                                     activity.type === 'transit' ? 'Navegando' : 'Indefinido'}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 ml-4">
                                <div className="text-gray-300 font-medium text-base">{formatDurationWithUnits(activity.value)}</div>
                                <div className="text-gray-400 text-sm">{percentage}%</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Gráfico de quesos */}
                  <div className="w-full lg:w-1/2" style={{ height: '350px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
  )
}
