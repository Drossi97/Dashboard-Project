// Colores para los trayectos - compartido entre componentes
export const JOURNEY_COLORS = [
  '#FF4444', // Rojo brillante
  '#00AA44', // Verde oscuro
  '#0066CC', // Azul oscuro
  '#FF8800', // Naranja brillante
  '#8800AA', // Morado oscuro
  '#CC6600', // Marrón oscuro
  '#00AAAA', // Cian oscuro
  '#AA4400', // Rojo oscuro
  '#0044AA', // Azul muy oscuro
  '#AA0088'  // Magenta oscuro
]

// Función para obtener el color de un trayecto por su índice
export const getJourneyColor = (journeyIndex: number): string => {
  return JOURNEY_COLORS[journeyIndex % JOURNEY_COLORS.length]
}
