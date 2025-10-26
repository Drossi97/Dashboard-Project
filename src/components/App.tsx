import React, { useState, useRef } from "react"
import { useCSVInterval } from "../hooks/useCSVInterval"
import { FileUploader } from "./FileUploader"
import MapViewer, { MapViewerRef } from "./MapViewer"
import JourneySelector from "./JourneySelector"
import SpeedProfile from "./SpeedProfile"
import ActivityDistribution from "./ActivityDistribution"
import JourneyComparison from "./JourneyComparison"

export default function App() {
  const [files, setFiles] = useState<File[]>([])
  const [showUploader, setShowUploader] = useState(true)
  const [selectedJourneys, setSelectedJourneys] = useState<Set<number>>(new Set())
  const [showStats, setShowStats] = useState(false)
  const [activeStatsView, setActiveStatsView] = useState<'speed' | 'activity' | 'comparison'>('speed')
  
  const csvProcessor = useCSVInterval()
  const mapViewerRef = useRef<MapViewerRef>(null)

  // Procesar archivos CSV
  const handleProcessFiles = async () => {
    if (files.length === 0 || csvProcessor.isProcessing) return

    
    try {
      const result = await csvProcessor.processFiles(files)
      
      if (result?.success && 'data' in result && result.data) {
        
        // Ocultar el uploader después del procesamiento exitoso
        setShowUploader(false)
      } else {
      }
    } catch (error) {
    }
  }

  // Alternar selección de trayecto
  const toggleJourneySelection = (journeyIndex: number) => {
    
    const newSelectedJourneys = new Set(selectedJourneys)
    if (newSelectedJourneys.has(journeyIndex)) {
      newSelectedJourneys.delete(journeyIndex)
    } else {
      newSelectedJourneys.add(journeyIndex)
    }
    
    setSelectedJourneys(newSelectedJourneys)
  }

  // Seleccionar todos los trayectos
  const selectAllJourneys = () => {
    if (!csvProcessor.results?.data?.journeys) return
    
    // Extraer todos los journeyIndex de los journeys
    const allJourneyIndexes = new Set<number>(
      csvProcessor.results.data.journeys.map(journey => journey.journeyIndex)
    )
    
    setSelectedJourneys(allJourneyIndexes)
  }

  // Deseleccionar todos los trayectos
  const deselectAllJourneys = () => {
    setSelectedJourneys(new Set())
  }

  // Alternar múltiples trayectos de una vez
  const toggleMultipleJourneys = (journeyIndices: number[]) => {
    const newSelectedJourneys = new Set(selectedJourneys)
    const allSelected = journeyIndices.every(index => newSelectedJourneys.has(index))
    
    if (allSelected) {
      // Deseleccionar todos
      journeyIndices.forEach(index => {
        newSelectedJourneys.delete(index)
      })
    } else {
      // Seleccionar todos
      journeyIndices.forEach(index => {
        newSelectedJourneys.add(index)
      })
    }
    
    setSelectedJourneys(newSelectedJourneys)
  }

  // Reiniciar para cargar nuevos archivos
  const resetForNewFiles = () => {
    setFiles([])
    setShowUploader(true)
    setSelectedJourneys(new Set())
    csvProcessor.clearResults()
    mapViewerRef.current?.clearMap()
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white">
      {/* Mapa */}
      <MapViewer 
        ref={mapViewerRef}
        csvResults={csvProcessor.results}
        selectedJourneys={selectedJourneys}
      />

      {/* Componente para subir CSV */}
      {showUploader && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-black/30 backdrop-blur-sm">
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

      {/* Botón para reiniciar */}
      {!showUploader && (
        <div className="absolute top-4 left-4 z-[9998]">
          <button
            onClick={resetForNewFiles}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="font-medium">Cargar Nuevos Archivos</span>
          </button>
        </div>
      )}

      {/* Selector de trayectos - solo mostrar cuando no hay uploader */}
      {!showUploader && (
        <JourneySelector
          csvResults={csvProcessor.results}
          selectedJourneys={selectedJourneys}
          onToggleJourney={toggleJourneySelection}
          onShowStats={() => setShowStats(true)}
          onStatsViewChange={setActiveStatsView}
          onSelectAll={selectAllJourneys}
          onDeselectAll={deselectAllJourneys}
          onToggleMultipleJourneys={toggleMultipleJourneys}
        />
      )}

      {/* Estadísticas - Vista unificada */}
      {activeStatsView === 'speed' && (
        <SpeedProfile
          csvResults={csvProcessor.results}
          selectedJourneys={selectedJourneys}
          isVisible={showStats}
          onClose={() => setShowStats(false)}
          onViewChange={setActiveStatsView}
        />
      )}
      
      {activeStatsView === 'activity' && (
        <ActivityDistribution
          csvResults={csvProcessor.results}
          selectedJourneys={selectedJourneys}
          isVisible={showStats}
          onClose={() => setShowStats(false)}
          onViewChange={setActiveStatsView}
        />
      )}
      
      {activeStatsView === 'comparison' && (
        <JourneyComparison
          csvResults={csvProcessor.results}
          selectedJourneys={selectedJourneys}
          journeys={csvProcessor.results?.data?.journeys || []}
          intervalData={[]}
          colors={{}}
          isVisible={showStats}
          onClose={() => setShowStats(false)}
          onViewChange={setActiveStatsView}
        />
      )}

    </div>
  )
}