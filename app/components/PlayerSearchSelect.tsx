'use client'

import { useState, useRef, useEffect } from 'react'

interface Player {
  id: string
  name: string
  category: number | null
  rating: number | null
}

interface PlayerSearchSelectProps {
  players: Player[]
  value: string
  onChange: (playerId: string) => void
  placeholder?: string
  label?: string
  required?: boolean
  excludeIds?: string[]
  className?: string
}

export default function PlayerSearchSelect({
  players,
  value,
  onChange,
  placeholder = 'Buscar jugador...',
  label,
  required = false,
  excludeIds = [],
  className = ''
}: PlayerSearchSelectProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get selected player name for display
  const selectedPlayer = players.find(p => p.id === value)
  const displayValue = selectedPlayer 
    ? `${selectedPlayer.name} ${selectedPlayer.category ? `(${selectedPlayer.category}°)` : ''}`
    : ''

  // Filter players based on search term
  const filteredPlayers = players.filter(p => {
    // Exclude specific IDs
    if (excludeIds.includes(p.id)) return false
    // Filter by search term (name)
    if (!searchTerm.trim()) return true
    const searchLower = searchTerm.toLowerCase()
    return p.name.toLowerCase().includes(searchLower)
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [searchTerm, excludeIds])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setIsOpen(true)
  }

  const handleSelect = (player: Player) => {
    onChange(player.id)
    setSearchTerm('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const handleClear = () => {
    onChange('')
    setSearchTerm('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredPlayers.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (filteredPlayers[highlightedIndex]) {
          handleSelect(filteredPlayers[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  // Show selected or search input
  const showSelected = value && !isOpen

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={showSelected ? displayValue : searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={showSelected ? '' : placeholder}
          required={required && !value}
          className="block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500 pr-8"
        />
        
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">Limpiar</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Hidden input for form submission */}
      <input type="hidden" name={label} value={value} />

      {/* Dropdown */}
      {isOpen && filteredPlayers.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          <ul className="py-1">
            {filteredPlayers.map((player, index) => (
              <li
                key={player.id}
                onClick={() => handleSelect(player)}
                className={`px-3 py-2 cursor-pointer text-sm ${
                  index === highlightedIndex
                    ? 'bg-blue-50 text-blue-900'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="font-medium">{player.name}</span>
                {player.category && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({player.category}°)
                  </span>
                )}
                {player.rating && (
                  <span className="ml-2 text-xs text-gray-400">
                    {player.rating.toFixed(0)} pts
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No results */}
      {isOpen && searchTerm && filteredPlayers.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          <p className="px-3 py-2 text-sm text-gray-500">
            No se encontraron jugadores
          </p>
        </div>
      )}
    </div>
  )
}
