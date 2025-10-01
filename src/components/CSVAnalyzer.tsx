import React, { useState } from "react"
import { FileUploader } from "./FileUploader"
import { LineChart } from "./LineChart"
import { NavigationAnalysis } from "./NavigationAnalysis"
import { useCSVProcessor } from "../hooks/useCSVProcessor"

export default function CSVAnalyzer() {
  const [files, setFiles] = useState<File[]>([])
  const [selectedIntervals, setSelectedIntervals] = useState<number[]>([])
  const { results, isProcessing, processFiles, clearResults } = useCSVProcessor()

  const handleFilesChange = (newFiles: File[]) => {
    setFiles(newFiles)
    if (newFiles.length === 0) {
      clearResults()
      setSelectedIntervals([])
    }
  }

  const handleAnalyze = () => {
    processFiles(files)
    setSelectedIntervals([])
  }

  const handleIntervalClick = (intervalIndex: number) => {
    setSelectedIntervals(prev => {
      if (prev.includes(intervalIndex)) {
        // Si ya está seleccionado, lo deseleccionamos
        return prev.filter(i => i !== intervalIndex)
      } else {
        // Si no está seleccionado, lo agregamos
        return [...prev, intervalIndex].sort((a, b) => a - b)
      }
    })
  }

  const downloadJSON = () => {
    if (!results) return
    
    const dataStr = JSON.stringify(results, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `navigation-data-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-6 space-y-6 max-w-7xl">
        <FileUploader
          files={files}
          onFilesChange={handleFilesChange}
          onAnalyze={handleAnalyze}
          isProcessing={isProcessing}
        />

        {/* Botón de descarga JSON */}
        {results && results.success && (
          <div className="flex justify-end">
            <button
              onClick={downloadJSON}
              className="px-4 py-2 text-sm rounded-lg transition-all hover:bg-gray-700"
              style={{
                backgroundColor: '#2C2C2C',
                border: 'none',
                color: '#60A5FA'
              }}
            >
              📥 Descargar JSON
            </button>
          </div>
        )}

        <LineChart 
          results={results} 
          onIntervalClick={handleIntervalClick}
          selectedIntervals={selectedIntervals}
        />

        <NavigationAnalysis 
          results={results}
          selectedIntervals={selectedIntervals}
          setSelectedIntervals={setSelectedIntervals}
        />
      </div>
    </div>
  )
}
