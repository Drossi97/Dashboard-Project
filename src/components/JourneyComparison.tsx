import React, { useState, useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Journey } from '../hooks/useCSVInterval';
import { CSVIntervalResult } from '../hooks/useCSVInterval';
import { parseDurationToSeconds, formatDuration } from '../lib/utils';

interface JourneyComparisonProps {
  csvResults: CSVIntervalResult | null;
  selectedJourneys: Set<number>;
  journeys: Journey[];
  intervalData: any[];
  colors: Record<string, string>;
  isVisible: boolean;
  onClose: () => void;
  onViewChange?: (view: 'speed' | 'activity' | 'comparison') => void;
}

const JourneyComparison: React.FC<JourneyComparisonProps> = ({
  csvResults,
  selectedJourneys,
  journeys,
  intervalData,
  colors,
  isVisible,
  onClose,
  onViewChange
}) => {
  const [groupA, setGroupA] = useState<Set<number>>(new Set());
  const [groupB, setGroupB] = useState<Set<number>>(new Set());
  const [hoveredIndexA, setHoveredIndexA] = useState<number | null>(null);
  const [hoveredIndexB, setHoveredIndexB] = useState<number | null>(null);
  const [expandedDaysA, setExpandedDaysA] = useState<Set<string>>(new Set());
  const [expandedDaysB, setExpandedDaysB] = useState<Set<string>>(new Set());

  // Colores para el pie chart
  const CHART_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316'
  ];

  // Función helper para formatear fecha
  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return ''
    }
  }

  // Extraer datos de intervalos desde journeys
  const extractedIntervalData = useMemo(() => {
    if (!csvResults?.success || !csvResults.data?.journeys || selectedJourneys.size === 0) {
      return [];
    }

    const intervalData: any[] = [];
    
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
            navStatus: interval.navStatus,
            activity: interval.classificationType
          });
        });
      }
    });
    
    return intervalData;
  }, [csvResults, selectedJourneys]);

  const toggleJourneyInGroup = useCallback((journeyId: number, group: 'A' | 'B') => {
    if (group === 'A') {
      setGroupA(prev => {
        const newGroupA = new Set(prev);
        if (newGroupA.has(journeyId)) {
          newGroupA.delete(journeyId);
        } else {
          newGroupA.add(journeyId);
          // Remover de grupo B si está ahí
          setGroupB(prevB => {
            const newGroupB = new Set(prevB);
            newGroupB.delete(journeyId);
            return newGroupB;
          });
        }
        return newGroupA;
      });
    } else {
      setGroupB(prev => {
        const newGroupB = new Set(prev);
        if (newGroupB.has(journeyId)) {
          newGroupB.delete(journeyId);
        } else {
          newGroupB.add(journeyId);
          // Remover de grupo A si está ahí
          setGroupA(prevA => {
            const newGroupA = new Set(prevA);
            newGroupA.delete(journeyId);
            return newGroupA;
          });
        }
        return newGroupB;
      });
    }
  }, []);

  const { data: intervalDataGroupA, totalDuration: totalDurationA } = useMemo(() => {
    if (groupA.size === 0) return { data: [], totalDuration: 0 };
    
    const groupAIntervals = extractedIntervalData.filter(interval => 
      groupA.has(interval.journeyIndex)
    );
    
    const activityCounts: Record<string, { count: number, duration: number }> = {};
    groupAIntervals.forEach(interval => {
      const activity = interval.activity || 'Sin actividad';
      if (!activityCounts[activity]) {
        activityCounts[activity] = { count: 0, duration: 0 };
      }
      activityCounts[activity].count += 1;
      activityCounts[activity].duration += interval.durationInSeconds;
    });
    
    const totalDuration = groupAIntervals.reduce((sum, interval) => sum + interval.durationInSeconds, 0);
    
    const data = Object.entries(activityCounts).map(([activity, data], index) => ({
      name: activity,
      value: data.duration,
      count: data.count,
      color: CHART_COLORS[index % CHART_COLORS.length],
      percentage: totalDuration > 0 ? (data.duration / totalDuration * 100) : 0
    }));
    
    return { data, totalDuration };
  }, [groupA, extractedIntervalData]);

  const { data: intervalDataGroupB, totalDuration: totalDurationB } = useMemo(() => {
    if (groupB.size === 0) return { data: [], totalDuration: 0 };
    
    const groupBIntervals = extractedIntervalData.filter(interval => 
      groupB.has(interval.journeyIndex)
    );
    
    const activityCounts: Record<string, { count: number, duration: number }> = {};
    groupBIntervals.forEach(interval => {
      const activity = interval.activity || 'Sin actividad';
      if (!activityCounts[activity]) {
        activityCounts[activity] = { count: 0, duration: 0 };
      }
      activityCounts[activity].count += 1;
      activityCounts[activity].duration += interval.durationInSeconds;
    });
    
    const totalDuration = groupBIntervals.reduce((sum, interval) => sum + interval.durationInSeconds, 0);
    
    const data = Object.entries(activityCounts).map(([activity, data], index) => ({
      name: activity,
      value: data.duration,
      count: data.count,
      color: CHART_COLORS[index % CHART_COLORS.length],
      percentage: totalDuration > 0 ? (data.duration / totalDuration * 100) : 0
    }));
    
    return { data, totalDuration };
  }, [groupB, extractedIntervalData]);

  const getJourneyLabel = (journey: Journey) => {
    if (journey.metadata?.isIncomplete) {
      return `Trayecto ${journey.journeyIndex} (Trayecto incompleto)`;
    }
    const departure = journey.metadata?.startPort || 'Puerto desconocido';
    const arrival = journey.metadata?.endPort || 'Puerto desconocido';
    return `Trayecto ${journey.journeyIndex} (${departure} → ${arrival})`;
  };


  const availableJourneys = journeys.filter(journey => selectedJourneys.has(journey.journeyIndex));

  // Agrupar trayectos por día
  const journeysByDay = useMemo(() => {
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

  // Funciones para alternar expansión de días
  const toggleDayExpansionA = (dayKey: string) => {
    setExpandedDaysA(prev => {
      const newSet = new Set(prev)
      if (newSet.has(dayKey)) {
        newSet.delete(dayKey)
      } else {
        newSet.add(dayKey)
      }
      return newSet
    })
  }

  const toggleDayExpansionB = (dayKey: string) => {
    setExpandedDaysB(prev => {
      const newSet = new Set(prev)
      if (newSet.has(dayKey)) {
        newSet.delete(dayKey)
      } else {
        newSet.add(dayKey)
      }
      return newSet
    })
  }

  // Funciones para seleccionar/deseleccionar todos los trayectos de un día
  const toggleDayJourneysA = (dayKey: string) => {
    const dayJourneys = journeysByDay.grouped[dayKey]
    const dayJourneyIndices = dayJourneys.map(j => j.journeyIndex)
    const allSelected = dayJourneyIndices.every(index => groupA.has(index))
    
    if (allSelected) {
      // Deseleccionar todos los trayectos del día
      dayJourneyIndices.forEach(index => {
        if (groupA.has(index)) {
          setGroupA(prev => {
            const newGroupA = new Set(prev)
            newGroupA.delete(index)
            return newGroupA
          })
        }
      })
    } else {
      // Seleccionar todos los trayectos del día que no estén seleccionados
      dayJourneyIndices.forEach(index => {
        if (!groupA.has(index)) {
          setGroupA(prev => {
            const newGroupA = new Set(prev)
            newGroupA.add(index)
            // Remover de grupo B si está ahí
            setGroupB(prevB => {
              const newGroupB = new Set(prevB)
              newGroupB.delete(index)
              return newGroupB
            })
            return newGroupA
          })
        }
      })
    }
  }

  const toggleDayJourneysB = (dayKey: string) => {
    const dayJourneys = journeysByDay.grouped[dayKey]
    const dayJourneyIndices = dayJourneys.map(j => j.journeyIndex)
    const allSelected = dayJourneyIndices.every(index => groupB.has(index))
    
    if (allSelected) {
      // Deseleccionar todos los trayectos del día
      dayJourneyIndices.forEach(index => {
        if (groupB.has(index)) {
          setGroupB(prev => {
            const newGroupB = new Set(prev)
            newGroupB.delete(index)
            return newGroupB
          })
        }
      })
    } else {
      // Seleccionar todos los trayectos del día que no estén seleccionados
      dayJourneyIndices.forEach(index => {
        if (!groupB.has(index)) {
          setGroupB(prev => {
            const newGroupB = new Set(prev)
            newGroupB.add(index)
            // Remover de grupo A si está ahí
            setGroupA(prevA => {
              const newGroupA = new Set(prevA)
              newGroupA.delete(index)
              return newGroupA
            })
            return newGroupB
          })
        }
      })
    }
  }

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 left-4 z-[999998] dashboard-component">
      <style dangerouslySetInnerHTML={{
        __html: `
          .comparison-scroll::-webkit-scrollbar {
            width: 0px;
            background: transparent;
          }
          .comparison-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .comparison-scroll::-webkit-scrollbar-thumb {
            background: transparent;
            border-radius: 4px;
          }
          .comparison-scroll::-webkit-scrollbar-thumb:hover {
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
                  onClick={() => onViewChange('activity')}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 text-sm rounded-md transition-all duration-200"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                  Distribución de Actividades
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2 text-white text-sm rounded-md shadow-sm transition-all duration-200"
                  style={{ backgroundColor: '#2563EB' }}
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
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto comparison-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="space-y-6">
      {/* Selectores de grupos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        {/* Trayectos A */}
            <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: '#2D3748' }}>
          <h3 className="text-lg font-semibold mb-4 text-blue-400">Trayectos A</h3>
          <div className="border-b mb-4" style={{ borderBottomWidth: '1px', borderBottomColor: '#4B5563' }}></div>
          <div className="space-y-2 max-h-48 overflow-y-auto comparison-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {availableJourneys.length === 0 ? (
              <div className="text-sm p-2" style={{ color: '#9CA3AF' }}>No hay trayectos seleccionados</div>
            ) : (
              journeysByDay.sortedDays.map(dayKey => {
                const dayJourneys = journeysByDay.grouped[dayKey]
                const isExpanded = expandedDaysA.has(dayKey)
                const allSelectedInDay = dayJourneys.every(journey => groupA.has(journey.journeyIndex))
                
                return (
                  <div key={dayKey} className="space-y-1">
                    {/* Header del día */}
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-gray-700 p-2 rounded transition-colors"
                      onClick={() => toggleDayExpansionA(dayKey)}
                    >
                      <div className="flex items-center space-x-2">
                        <svg 
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-medium text-gray-300">
                          {dayKey} ({dayJourneys.length} trayectos)
                        </span>
                      </div>
                      <div 
                        className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors cursor-pointer ${
                          allSelectedInDay
                            ? 'bg-green-600 border-green-600'
                            : 'bg-transparent border-gray-400 hover:border-gray-300'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleDayJourneysA(dayKey)
                        }}
                      >
                        {allSelectedInDay && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    {/* Trayectos del día (solo si está expandido) */}
                    {isExpanded && (
                      <div className="space-y-1 ml-4">
                        {dayJourneys.map((journey) => {
                          const isSelected = groupA.has(journey.journeyIndex)
                          
                          return (
                            <label key={journey.journeyIndex} className={`flex items-center space-x-2 cursor-pointer hover:bg-gray-700 p-2 rounded transition-colors`} style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent' }}>
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleJourneyInGroup(journey.journeyIndex, 'A')}
                                  className="sr-only"
                                />
                                <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'bg-green-600 border-green-600'
                                    : 'bg-transparent border-gray-400 hover:border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <span className="text-sm text-gray-300">{getJourneyLabel(journey)}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Trayectos B */}
            <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: '#2D3748' }}>
          <h3 className="text-lg font-semibold mb-4 text-red-400">Trayectos B</h3>
          <div className="border-b mb-4" style={{ borderBottomWidth: '1px', borderBottomColor: '#4B5563' }}></div>
          <div className="space-y-2 max-h-48 overflow-y-auto comparison-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {availableJourneys.length === 0 ? (
              <div className="text-sm p-2" style={{ color: '#9CA3AF' }}>No hay trayectos seleccionados</div>
            ) : (
              journeysByDay.sortedDays.map(dayKey => {
                const dayJourneys = journeysByDay.grouped[dayKey]
                const isExpanded = expandedDaysB.has(dayKey)
                const allSelectedInDay = dayJourneys.every(journey => groupB.has(journey.journeyIndex))
                
                return (
                  <div key={dayKey} className="space-y-1">
                    {/* Header del día */}
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-gray-700 p-2 rounded transition-colors"
                      onClick={() => toggleDayExpansionB(dayKey)}
                    >
                      <div className="flex items-center space-x-2">
                        <svg 
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-medium text-gray-300">
                          {dayKey} ({dayJourneys.length} trayectos)
                        </span>
                      </div>
                      <div 
                        className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors cursor-pointer ${
                          allSelectedInDay
                            ? 'bg-green-600 border-green-600'
                            : 'bg-transparent border-gray-400 hover:border-gray-300'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleDayJourneysB(dayKey)
                        }}
                      >
                        {allSelectedInDay && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    {/* Trayectos del día (solo si está expandido) */}
                    {isExpanded && (
                      <div className="space-y-1 ml-4">
                        {dayJourneys.map((journey) => {
                          const isSelected = groupB.has(journey.journeyIndex)
                          
                          return (
                            <label key={journey.journeyIndex} className={`flex items-center space-x-2 cursor-pointer hover:bg-gray-700 p-2 rounded transition-colors`} style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent' }}>
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleJourneyInGroup(journey.journeyIndex, 'B')}
                                  className="sr-only"
                                />
                                <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'bg-green-600 border-green-600'
                                    : 'bg-transparent border-gray-400 hover:border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <span className="text-sm text-gray-300">{getJourneyLabel(journey)}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Gráficos de comparación */}
      {(groupA.size > 0 || groupB.size > 0) && (
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6">
          {/* Gráfico Trayectos A */}
          {groupA.size > 0 && intervalDataGroupA.length > 0 && (
            <div className="flex-1 rounded-lg p-3 sm:p-4 lg:p-6 overflow-hidden" style={{ backgroundColor: '#2D3748' }}>
              <div className="h-60 sm:h-70 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie
                       data={intervalDataGroupA}
                       cx="50%"
                       cy="50%"
                       labelLine={false}
                       label={false}
                       outerRadius={80}
                       fill="#8884d8"
                       dataKey="value"
                       onMouseEnter={(data, index) => setHoveredIndexA(index)}
                       onMouseLeave={() => setHoveredIndexA(null)}
                     >
                       {intervalDataGroupA.map((entry, index) => (
                         <Cell 
                           key={`cell-${index}`} 
                           fill={entry.color}
                           stroke={hoveredIndexA === index ? '#FFFFFF' : 'none'}
                           strokeWidth={hoveredIndexA === index ? 3 : 0}
                           style={{
                             filter: hoveredIndexA !== null && hoveredIndexA !== index ? 'opacity(0.3)' : 'opacity(1)',
                             transition: 'all 0.2s ease-in-out'
                           }}
                         />
                       ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
               <div className="mt-4 space-y-1">
                 {groupA.size > 0 && (
                   <div className="flex items-center justify-between text-sm font-semibold text-blue-300 mb-2 p-1 rounded" style={{ backgroundColor: '#2D3748' }}>
                     <span>Total Trayectos A:</span>
                     <span>{formatDuration(totalDurationA)}</span>
                   </div>
                 )}
                 <div className="border-b mb-2" style={{ borderBottomWidth: '1px', borderBottomColor: '#4B5563' }}></div>
                 {intervalDataGroupA.map((item, index) => (
                   <div 
                     key={index} 
                        className={`cursor-pointer transition-all duration-200 rounded p-2 hover:bg-gray-700 ${
                          hoveredIndexA === index 
                            ? 'bg-gray-700' 
                            : ''
                        }`}
                     onMouseEnter={() => setHoveredIndexA(index)}
                     onMouseLeave={() => setHoveredIndexA(null)}
                   >
                     <div className="flex items-center space-x-2 mb-1">
                       <div 
                         className={`w-3 h-3 rounded-full transition-all duration-200 flex-shrink-0 ${
                           hoveredIndexA === index ? 'scale-110 shadow-md' : ''
                         }`}
                         style={{ 
                           backgroundColor: item.color,
                           boxShadow: hoveredIndexA === index ? `0 0 8px ${item.color}40` : 'none'
                         }}
                       />
                       <span className={`transition-colors duration-200 text-sm ${
                         hoveredIndexA === index ? 'text-white' : 'text-gray-300'
                       }`}>{item.name}</span>
                     </div>
                     <div className={`transition-colors duration-200 text-xs ml-5 ${
                       hoveredIndexA === index ? 'text-gray-200' : 'text-gray-400'
                     }`}>{formatDuration(item.value)} ({item.percentage.toFixed(1)}%)</div>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {/* Gráfico Trayectos B */}
          {groupB.size > 0 && intervalDataGroupB.length > 0 && (
            <div className="flex-1 rounded-lg p-3 sm:p-4 lg:p-6 overflow-hidden" style={{ backgroundColor: '#2D3748' }}>
              <div className="h-60 sm:h-70 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie
                       data={intervalDataGroupB}
                       cx="50%"
                       cy="50%"
                       labelLine={false}
                       label={false}
                       outerRadius={80}
                       fill="#8884d8"
                       dataKey="value"
                       onMouseEnter={(data, index) => setHoveredIndexB(index)}
                       onMouseLeave={() => setHoveredIndexB(null)}
                     >
                       {intervalDataGroupB.map((entry, index) => (
                         <Cell 
                           key={`cell-${index}`} 
                           fill={entry.color}
                           stroke={hoveredIndexB === index ? '#FFFFFF' : 'none'}
                           strokeWidth={hoveredIndexB === index ? 3 : 0}
                           style={{
                             filter: hoveredIndexB !== null && hoveredIndexB !== index ? 'opacity(0.3)' : 'opacity(1)',
                             transition: 'all 0.2s ease-in-out'
                           }}
                         />
                       ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
               <div className="mt-4 space-y-1">
                 {groupB.size > 0 && (
                   <div className="flex items-center justify-between text-sm font-semibold text-red-300 mb-2 p-1 rounded" style={{ backgroundColor: '#2D3748' }}>
                     <span>Total Trayectos B:</span>
                     <span>{formatDuration(totalDurationB)}</span>
                   </div>
                 )}
                 <div className="border-b mb-2" style={{ borderBottomWidth: '1px', borderBottomColor: '#4B5563' }}></div>
                 {intervalDataGroupB.map((item, index) => (
                   <div 
                     key={index} 
                        className={`cursor-pointer transition-all duration-200 rounded p-2 hover:bg-gray-700 ${
                          hoveredIndexB === index 
                            ? 'bg-gray-700' 
                            : ''
                        }`}
                     onMouseEnter={() => setHoveredIndexB(index)}
                     onMouseLeave={() => setHoveredIndexB(null)}
                   >
                     <div className="flex items-center space-x-2 mb-1">
                       <div 
                         className={`w-3 h-3 rounded-full transition-all duration-200 flex-shrink-0 ${
                           hoveredIndexB === index ? 'scale-110 shadow-md' : ''
                         }`}
                         style={{ 
                           backgroundColor: item.color,
                           boxShadow: hoveredIndexB === index ? `0 0 8px ${item.color}40` : 'none'
                         }}
                       />
                       <span className={`transition-colors duration-200 text-sm ${
                         hoveredIndexB === index ? 'text-white' : 'text-gray-300'
                       }`}>{item.name}</span>
                     </div>
                     <div className={`transition-colors duration-200 text-xs ml-5 ${
                       hoveredIndexB === index ? 'text-gray-200' : 'text-gray-400'
                     }`}>{formatDuration(item.value)} ({item.percentage.toFixed(1)}%)</div>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>
      )}

      {/* Mensaje cuando no hay grupos seleccionados */}
      {groupA.size === 0 && groupB.size === 0 && (
        <div className="text-center py-12" style={{ color: '#9CA3AF' }}>
          <p className="text-lg mb-2">Selecciona trayectos para comparar</p>
          <p className="text-sm">Usa los selectores de arriba para asignar trayectos a los grupos A y B</p>
        </div>
      )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JourneyComparison;
