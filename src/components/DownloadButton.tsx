import React from "react"
import { Download } from "lucide-react"

interface DownloadButtonProps {
  data: any
  filename?: string
  disabled?: boolean
}

export function DownloadButton({ data, filename = "trayectos_data.json", disabled = false }: DownloadButtonProps) {
  const handleDownload = () => {
    if (!data) return

    try {
      // Convertir los datos a JSON con formato legible
      const jsonString = JSON.stringify(data, null, 2)
      
      // Crear blob con el contenido JSON
      const blob = new Blob([jsonString], { type: 'application/json' })
      
      // Crear URL temporal para el blob
      const url = URL.createObjectURL(blob)
      
      // Crear elemento de descarga temporal
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      
      // Añadir al DOM, hacer clic y remover
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Limpiar la URL temporal
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al descargar el archivo:', error)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || !data}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
        disabled || !data
          ? 'bg-gray-600 text-gray-400 border-gray-600 cursor-not-allowed'
          : 'bg-green-600 hover:bg-green-700 text-white border-green-500 hover:border-green-400'
      }`}
    >
      <Download className="h-4 w-4" />
      <span className="text-sm font-medium">
        {disabled || !data ? 'Sin datos' : 'Descargar JSON'}
      </span>
    </button>
  )
}
