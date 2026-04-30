import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'qpb_sections'

function readSectionStates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeSectionStates(states) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states))
  } catch {
    // Silent fail
  }
}

/**
 * Hook to manage collapsible section state with localStorage persistence
 * @param {string} sectionId - Unique identifier for this section
 * @param {boolean} defaultOpen - Default open state if no saved state exists
 * @returns {[boolean, function]} - [isOpen, setOpen]
 */
export function useSectionState(sectionId, defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(() => {
    const states = readSectionStates()
    return states[sectionId] !== undefined ? states[sectionId] : defaultOpen
  })

  useEffect(() => {
    const states = readSectionStates()
    states[sectionId] = isOpen
    writeSectionStates(states)
  }, [sectionId, isOpen])

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  return [isOpen, setIsOpen, toggle]
}
