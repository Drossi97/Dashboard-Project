import React, { useState, useRef, useEffect } from "react"
import { useCSVProcessor } from "../hooks/useCSVProcessor"
import { FileUploader } from "./FileUploader"
import JourneySelector from "./JourneySelector"
import MapViewer, { MapViewerRef } from "./MapViewer"

export default function App() {
  const [files, setFiles] = useState<File[]>([])
  const [selectedJourneys, setSelectedJourneys] = useState<Set<number>>(new Set())
  const [availableJourneys, setAvailableJourneys] = useState<Array<{index: number, startPort: string, endPort: string, intervalCount: number}>>([])
  const [showUploader, setShowUploader] = useState(true)
  
  const mapViewerRef = useRef<MapViewerRef>(null)
  const csvProcessor = useCSVProcessor()

  // Debug: Log cuando cambie selectedJourneys
  useEffect(() => {
    console.log('🔍 selectedJourneys cambió:', Array.from(selectedJourneys))
  }, [selectedJourneys])


  // Procesar archivos CSV
  const handleProcessFiles = async () => {
    if (files.length === 0 || csvProcessor.isProcessing) return

    console.log('=== PROCESANDO ARCHIVOS CSV ===')
    
    try {
      const result = await csvProcessor.processFiles(files)
      
      if (result?.success && 'data' in result && result.data) {
        console.log(`✅ Procesamiento completado: ${result.data.intervals.length} intervalos`)
        
        // Preparar lista de trayectos directamente con el resultado
        prepareJourneysListFromResult(result.data)
        
        // Ocultar el uploader después del procesamiento exitoso
        setShowUploader(false)
      } else {
        console.error('❌ Error en el procesamiento:', result?.error)
      }
    } catch (error) {
      console.error('Error procesando archivos:', error)
    }
  }

  // Función para determinar puertos de origen y destino basándose en estado 0.0
  const getJourneyPorts = (intervals: any[], journeyIndex: number) => {
    const journeyIntervals = intervals.filter(interval => interval.journeyIndex === journeyIndex)
    
    let startPort = 'Desconocido'
    let endPort = 'Desconocido'
    
    // Puerto de origen: primer intervalo con estado 0.0 cerca de un puerto
    for (const interval of journeyIntervals) {
      if (interval.navStatus === "0.0" && interval.startPort && interval.startPort.distance <= 3) {
        startPort = interval.startPort.name
        break
      }
    }
    
    // Puerto de destino: buscar último intervalo con estado 1.0, 
    // luego verificar si el siguiente tiene estado 0.0 cerca de un puerto
    let lastNavIntervalIndex = -1
    for (let i = journeyIntervals.length - 1; i >= 0; i--) {
      if (journeyIntervals[i].navStatus === "1.0") {
        lastNavIntervalIndex = i
        break
      }
    }
    
    // Si encontramos un intervalo con estado 1.0, verificar el siguiente
    if (lastNavIntervalIndex >= 0 && lastNavIntervalIndex + 1 < journeyIntervals.length) {
      const nextInterval = journeyIntervals[lastNavIntervalIndex + 1]
      if (nextInterval.navStatus === "0.0" && nextInterval.startPort && nextInterval.startPort.distance <= 3) {
        endPort = nextInterval.startPort.name
      }
    }
    
    return { startPort, endPort }
  }

  // Preparar lista de trayectos directamente desde el resultado del procesamiento
  const prepareJourneysListFromResult = (data: any) => {
    const intervals = data.intervals
    const journeyMap = new Map<number, {index: number, startPort: string, endPort: string, intervalCount: number}>()
    
    // Obtener todos los índices de trayectos únicos
    const uniqueJourneyIndexes = [...new Set(intervals.map((interval: any) => interval.journeyIndex || 0))]
    
    uniqueJourneyIndexes.forEach(journeyIndex => {
      const { startPort, endPort } = getJourneyPorts(intervals, journeyIndex as number)
      const intervalCount = intervals.filter((interval: any) => interval.journeyIndex === journeyIndex).length
      
      journeyMap.set(journeyIndex as number, {
        index: journeyIndex as number,
        startPort,
        endPort,
        intervalCount
      })
    })

    const journeys = Array.from(journeyMap.values()).sort((a, b) => a.index - b.index)
    console.log('🔍 Journeys preparados:', journeys)
    
    setAvailableJourneys(journeys)
    
    // No seleccionar automáticamente ningún trayecto - que aparezcan deseleccionados
    setSelectedJourneys(new Set())
    
    console.log(`Trayectos disponibles: ${journeys.length}`)
    console.log(`📋 Panel de trayectos listo - ninguno seleccionado inicialmente`)
  }

  // Preparar lista de trayectos disponibles y mostrar automáticamente todos
  const prepareJourneysList = () => {
    if (!csvProcessor.results?.success || !csvProcessor.results.data) return

    const intervals = csvProcessor.results.data.intervals
    const journeyMap = new Map<number, {index: number, startPort: string, endPort: string, intervalCount: number}>()
    
    // Obtener todos los índices de trayectos únicos
    const uniqueJourneyIndexes = [...new Set(intervals.map(interval => interval.journeyIndex || 0))]
    
    uniqueJourneyIndexes.forEach(journeyIndex => {
      const { startPort, endPort } = getJourneyPorts(intervals, journeyIndex as number)
      const intervalCount = intervals.filter(interval => interval.journeyIndex === journeyIndex).length
      
      journeyMap.set(journeyIndex as number, {
        index: journeyIndex as number,
        startPort,
        endPort,
        intervalCount
      })
    })

    const journeys = Array.from(journeyMap.values()).sort((a, b) => a.index - b.index)
    setAvailableJourneys(journeys)
    
    // Automáticamente seleccionar y mostrar todos los trayectos
    const allJourneyIndexes = new Set(journeys.map(j => j.index))
    setSelectedJourneys(allJourneyIndexes)
    
    console.log(`Trayectos disponibles: ${journeys.length}`)
    console.log(`🚀 Mostrando automáticamente ${allJourneyIndexes.size} trayectos`)
  }

  // Alternar selección de trayecto
  const toggleJourneySelection = (journeyIndex: number) => {
    console.log(`=== ALTERNANDO TRAYECTO ${journeyIndex} ===`)
    
    const newSelectedJourneys = new Set(selectedJourneys)
    
    if (newSelectedJourneys.has(journeyIndex)) {
      // Deseleccionar trayecto
      newSelectedJourneys.delete(journeyIndex)
      console.log(`Trayecto ${journeyIndex} deseleccionado`)
    } else {
      // Seleccionar trayecto
      newSelectedJourneys.add(journeyIndex)
      console.log(`Trayecto ${journeyIndex} seleccionado`)
    }
    
    setSelectedJourneys(newSelectedJourneys)
  }

  // Limpiar mapa y resetear selecciones
  const clearMap = () => {
    mapViewerRef.current?.clearMap()
    setSelectedJourneys(new Set())
    setAvailableJourneys([])
    csvProcessor.clearResults()
  }

  // Reiniciar para cargar nuevos archivos
  const resetForNewFiles = () => {
    setFiles([])
    setSelectedJourneys(new Set())
    setAvailableJourneys([])
    setShowUploader(true)
    csvProcessor.clearResults()
    mapViewerRef.current?.clearMap()
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Mapa */}
      <MapViewer 
        ref={mapViewerRef}
        intervals={csvProcessor.results?.data?.intervals || []}
        selectedJourneys={selectedJourneys}
      />

      {/* Componente para subir CSV - Centrado */}
      {showUploader && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
            <div className="w-full max-w-6xl mx-4">
            <FileUploader
              files={files}
              onFilesChange={setFiles}
              onProcessFiles={handleProcessFiles}
              isProcessing={csvProcessor.isProcessing}
            />
          </div>
        </div>
      )}

      {/* Botón para reiniciar y cargar nuevos archivos - Esquina superior izquierda */}
      {!showUploader && (
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={resetForNewFiles}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 border-2 border-blue-500"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="font-medium">Cargar Nuevos Archivos</span>
          </button>
        </div>
      )}

      {/* Componente para seleccionar trayectos */}
      <JourneySelector
        availableJourneys={availableJourneys}
        selectedJourneys={selectedJourneys}
        onToggleJourney={toggleJourneySelection}
        csvData={csvProcessor.results?.data}
      />
    </div>
  )
}