import { useState } from "react"

export interface RawDataRow {
  timestamp: string
  date: string
  time: string
  latitude: number | null
  longitude: number | null
  speed: number | null
  navStatus: string
  [key: string]: any // Para incluir todas las demás columnas del CSV original
}

export interface CSVConversionResult {
  success: boolean
  data?: RawDataRow[]
  error?: string
  meta?: {
    totalRows: number
    filesProcessed: number
    processedFiles: Array<{ file: string; rows: number }>
    errors: string[]
  }
}

// Constants
const COL_LAT = "00-lathr [deg]"
const COL_LON = "01-lonhr [deg]"
const COL_SPEED = "04-speed [knots]"
const COL_NAVSTATUS = "06-navstatus [adim]"
const COL_TIME = "time"

// Helper functions
const parseTimestampParts = (timestamp: string) => {
  if (!timestamp || typeof timestamp !== "string") return null
  const parts = timestamp.split(" ")
  if (parts.length < 2) return null
  return { date: parts[0], time: parts[1], raw: timestamp }
}

const csvTextToRows = (csvString: string, delimiter: string) => {
  if (!csvString?.trim()) return []
  
  const lines = csvString.replace(/\r\n?/g, "\n").trim().split("\n")
  if (lines.length < 2) return []
  
  const delim = delimiter === "\\t" || delimiter === "tab" ? "\t" : delimiter
  const headers = lines[0].split(delim).map((h) => h.trim())
  
  // Early validation
  const hasNavstatusHeader = headers.some((h) => h.toLowerCase().includes("navstatus"))
  const hasTimeHeader = headers.some((h) => h.trim() === COL_TIME)
  if (!hasNavstatusHeader || !hasTimeHeader) return []

  return lines.slice(1).map((line) => {
    const values = line.split(delim).map((v) => v.trim())
    const row: any = {}
    headers.forEach((header, idx) => {
      const key = header || `column_${idx}`
      const value = values[idx]
      row[key] = value === "" || value === undefined ? null : value
    })
    return row
  })
}

const normalizeRow = (row: any): RawDataRow => {
  const timestamp = row[COL_TIME]
  const parts = parseTimestampParts(timestamp)
  
  return {
    timestamp: timestamp || "",
    date: parts?.date || "",
    time: parts?.time || "",
    latitude: row[COL_LAT] ? Number.parseFloat(row[COL_LAT]) : null,
    longitude: row[COL_LON] ? Number.parseFloat(row[COL_LON]) : null,
    speed: row[COL_SPEED] ? Number.parseFloat(row[COL_SPEED]) : null,
    navStatus: row[COL_NAVSTATUS] || "",
    ...row // Incluir todas las demás columnas del CSV original
  }
}

export function useCSVConverter() {
  const [results, setResults] = useState<CSVConversionResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const convertCSVToJSON = async (
    fileContents: Array<{ name: string; content: string }>,
    delimiter: string = ","
  ): Promise<CSVConversionResult> => {
    try {
      let combined: any[] = []
      const processedFiles: Array<{ file: string; rows: number }> = []
      const errors: string[] = []

      // Procesar todos los archivos
      for (const { name, content } of fileContents) {
        try {
          const rows = csvTextToRows(content, delimiter)
          if (rows.length === 0) {
            errors.push(`Archivo sin datos válidos: ${name}`)
          } else {
            combined = combined.concat(rows)
            processedFiles.push({ file: name, rows: rows.length })
          }
        } catch (error) {
          errors.push(`Error procesando ${name}: ${error instanceof Error ? error.message : "Error desconocido"}`)
        }
      }

      if (combined.length === 0) {
        return {
          success: false,
          error: "No se pudieron leer filas válidas",
          meta: { 
            totalRows: 0, 
            filesProcessed: 0, 
            processedFiles, 
            errors 
          },
        }
      }

      // Ordenar todas las filas por timestamp cronológicamente
      combined.sort((a, b) => {
        const timeA = a?.[COL_TIME]
        const timeB = b?.[COL_TIME]
        
        if (!timeA || !timeB) return 0
        
        try {
          const dateA = new Date(timeA)
          const dateB = new Date(timeB)
          return dateA.getTime() - dateB.getTime()
        } catch {
          return 0
        }
      })

      // Normalizar los datos a la estructura RawDataRow
      const normalizedData = combined.map(normalizeRow)

      return {
        success: true,
        data: normalizedData,
        meta: {
          totalRows: normalizedData.length,
          filesProcessed: processedFiles.length,
          processedFiles,
          errors
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        meta: {
          totalRows: 0,
          filesProcessed: 0,
          processedFiles: [],
          errors: [error instanceof Error ? error.message : "Error desconocido"]
        }
      }
    }
  }

  const processFiles = async (files: File[], delimiter: string = ",") => {
    if (files.length === 0) {
      setResults(null)
      return
    }

    setIsProcessing(true)
    setResults(null)

    try {
      // Leer todos los archivos como texto
      const fileContents = await Promise.all(
        files.map(async (file) => {
          const text = await file.text()
          return { name: file.name, content: text }
        }),
      )

      // Convertir los datos CSV a JSON
      const conversionResult = await convertCSVToJSON(fileContents, delimiter)
      setResults(conversionResult)
      
      return conversionResult
    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido al procesar archivos",
        meta: {
          totalRows: 0,
          filesProcessed: 0,
          processedFiles: [],
          errors: [error instanceof Error ? error.message : "Error desconocido"]
        }
      }
      setResults(errorResult)
      return errorResult
    } finally {
      setIsProcessing(false)
    }
  }

  const clearResults = () => {
    setResults(null)
  }

  return {
    results,
    isProcessing,
    processFiles,
    clearResults,
    convertCSVToJSON, // Exposed for direct use if needed
  }
}
