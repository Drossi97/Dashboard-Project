import React, { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { FileText, X } from "lucide-react"

interface FileUploaderProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  onProcessFiles: () => void
  isProcessing: boolean
}

export function FileUploader({ files, onFilesChange, onProcessFiles, isProcessing }: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  // Prevenir el comportamiento por defecto del navegador para drag and drop
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    // Agregar listeners al documento para prevenir el comportamiento por defecto
    document.addEventListener('dragover', handleDragOver, false)
    document.addEventListener('drop', handleDrop, false)

    // Cleanup
    return () => {
      document.removeEventListener('dragover', handleDragOver, false)
      document.removeEventListener('drop', handleDrop, false)
    }
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    processFiles(selectedFiles)
    // Reset the input value to allow selecting the same file again if needed
    event.target.value = ""
  }

  const processFiles = (selectedFiles: File[]) => {
    const csvFiles = selectedFiles.filter(
      (file) => file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv",
    )

    // Add new files to existing ones, avoiding duplicates
    const newFiles = csvFiles.filter(
      (newFile) =>
        !files.some((existingFile) => existingFile.name === newFile.name && existingFile.size === newFile.size),
    )

    onFilesChange([...files, ...newFiles])
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragCounter(prev => prev + 1)
    if (dragCounter === 0) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragCounter(prev => prev - 1)
    if (dragCounter === 1) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
    setDragCounter(0)
    const droppedFiles = Array.from(event.dataTransfer.files)
    processFiles(droppedFiles)
  }

  const removeFile = (indexToRemove: number) => {
    const updatedFiles = files.filter((_, index) => index !== indexToRemove)
    onFilesChange(updatedFiles)
  }

  return (
    <div className="relative z-[10000]">
      <style dangerouslySetInnerHTML={{
        __html: `
          .file-scroll::-webkit-scrollbar {
            width: 0px;
            background: transparent;
          }
          .file-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .file-scroll::-webkit-scrollbar-thumb {
            background: transparent;
            border-radius: 4px;
          }
          .file-scroll::-webkit-scrollbar-thumb:hover {
            background: transparent;
          }
        `
      }} />
      {/* Fondo con blur y overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-2xl"></div>
      
      <Card className="relative bg-gradient-to-br from-gray-800/95 to-gray-900/95 border-2 border-gray-500/60 shadow-2xl backdrop-blur-md ring-1 ring-white/10 z-[10001]">
        <CardContent className="p-8">
          <div className="space-y-8 pt-8">

            {/* Zona de arrastre de archivos */}
            <div
              className={`w-full h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative group ${
                isDragOver
                  ? 'border-blue-400 bg-blue-500/20 scale-105 shadow-lg shadow-blue-500/20'
                  : 'border-gray-400 hover:border-blue-400 hover:bg-gray-700/40 hover:scale-102 hover:shadow-lg hover:shadow-gray-500/10'
              }`}
              style={{ backgroundColor: '#1F2937' }}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("files")?.click()}
            >
            <Input
              id="files"
              type="file"
              multiple
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />

              <div className="flex flex-col items-center space-y-3">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                    isDragOver 
                      ? 'bg-blue-500 scale-110' 
                      : 'bg-gradient-to-br from-blue-600 to-blue-700 group-hover:from-blue-500 group-hover:to-blue-600'
                  }`}
                >
                  <FileText className={`h-7 w-7 transition-colors duration-300 ${
                    isDragOver ? 'text-white' : 'text-blue-100'
                  }`} />
                </div>

                <div className="text-center">
                  <p className="text-lg text-white font-semibold mb-1">
                    {isDragOver ? '¡Suelta los archivos aquí!' : 'Arrastra archivos CSV aquí'}
                  </p>
                  <p className="text-sm text-gray-400">
                    o haz clic para seleccionar archivos
                  </p>
                </div>
              </div>

              {/* Indicador visual de drag over */}
              {isDragOver && (
                <div className="absolute inset-0 border-2 border-blue-400 border-dashed rounded-2xl bg-blue-500/30 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-400 flex items-center justify-center animate-pulse">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-blue-200 font-semibold text-lg">¡Suelta para subir!</p>
                  </div>
                </div>
              )}
          </div>

            {/* Área de archivos seleccionados */}
            {files.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-white font-semibold text-base">Archivos seleccionados</Label>
                  <span className="text-white text-xs font-medium">
                    {files.length} archivo{files.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto file-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="w-full flex items-center justify-between gap-2 p-3 rounded-lg transition-all duration-200 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-500/40 hover:border-gray-400/60 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-3 w-3 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-white font-medium truncate block" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="h-10 w-10 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/30 rounded-lg flex-shrink-0 transition-all duration-200"
                      >
                        <X className="h-6 w-6" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>

          <div className="flex justify-center pt-6">
            <button
              onClick={onProcessFiles}
              disabled={files.length === 0 || isProcessing}
              className={`px-6 py-3 text-base font-semibold rounded-xl transition-all duration-300 relative group ${
                files.length === 0 || isProcessing
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Procesando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  
                  Procesar Datos
                </div>
              )}
              
              {files.length > 0 && !isProcessing && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-400/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
