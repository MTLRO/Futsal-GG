"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface AdminContextType {
  isAuthenticated: boolean
  setIsAuthenticated: (value: boolean) => void
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  return (
    <AdminContext.Provider value={{ isAuthenticated, setIsAuthenticated }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider")
  }
  return context
}
