import React, { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Card, CardContent } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { FileText, X } from "lucide-react"

interface FileUploaderProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  onAnalyze: () => void
  isProcessing: boolean
}

export function FileUploader({ files, onFilesChange, onAnalyze, isProcessing }: FileUploaderProps) {
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
    <Card style={{ backgroundColor: '#171717', borderColor: '#2C2C2C' }}>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Zona de arrastre de archivos */}
          <div
            className={`w-full h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative ${
              isDragOver
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/30'
            }`}
            style={{ backgroundColor: '#2C2C2C' }}
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
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-md"
                style={{ backgroundColor: '#374151' }}
              >
                <FileText className="h-6 w-6 text-gray-200" />
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-300 font-medium">
                  {isDragOver ? 'Soltar archivos aquí' : 'Arrastra archivos CSV aquí'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  o haz clic para seleccionar
                </p>
              </div>
            </div>

            {/* Indicador visual de drag over */}
            {isDragOver && (
              <div className="absolute inset-0 border-2 border-blue-400 border-dashed rounded-xl bg-blue-500/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-blue-400 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-blue-300 font-medium">Soltar para subir</p>
                </div>
              </div>
            )}
          </div>

          {/* Área de archivos seleccionados */}
          {files.length > 0 && (
            <div className="space-y-3">
              <Label className="text-white font-medium text-sm">Archivos seleccionados ({files.length}):</Label>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-xl transition-all duration-200"
                    style={{
                      backgroundColor: '#2C2C2C'
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-gray-200 flex-shrink-0" />
                      <span className="text-sm text-white font-medium truncate" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-transparent rounded-lg flex-shrink-0 transition-all duration-200"
                      style={{ backgroundColor: 'transparent' }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center pt-4">
          <button
            onClick={onAnalyze}
            disabled={files.length === 0 || isProcessing}
            className="px-8 py-3 text-base font-medium relative group disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            style={{
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              color: files.length === 0 || isProcessing ? '#4B5563' : '#FFFFFF'
            }}
          >
            {isProcessing ? "Procesando..." : "Procesar Datos"}
            {files.length > 0 && !isProcessing && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-200"></div>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
