import React from "react"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className = "", children, ...props }: CardContentProps) {
  return (
    <div className={`p-6 pt-0 ${className}`} {...props}>
      {children}
    </div>
  )
}
