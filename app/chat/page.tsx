'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { supabase } from '@/lib/supabase/client'
import Header from '@/app/components/Header'

interface Conversation {
  id: string
  type: string
  name: string | null
  description: string | null
  is_group: boolean
  last_message_at: string
  last_message_preview: string | null
  unread_count: number
  other_participant_name: string | null
}

interface Message {
  id: string
  sender_id: string
  content: string
  content_type: string
  created_at: string
  sender?: { name: string }
  is_edited: boolean
  reply_to_id?: string
  reply_to?: { sender: { name: string }, content: string }
}

export default function ChatPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewChat, setShowNewChat] = useState(false)
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadConversations()
    loadUsers()
  }, [isLoading, isAuthenticated])

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv)
      markAsRead(selectedConv)
    }
  }, [selectedConv])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!user?.id) return
    
    // Subscribe to new messages
    const subscription = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedConv}`
      }, (payload) => {
        const newMsg = payload.new as Message
        if (newMsg.sender_id !== user.id) {
          setMessages(prev => [...prev, newMsg])
        }
      })
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
    }
  }, [selectedConv, user?.id])

  async function loadConversations() {
    if (!user) return
    
    const { data } = await supabase
      .from('user_conversations')
      .select('*')
      .eq('current_user_id', user.id)
      .order('last_message_at', { ascending: false })
    
    if (data) {
      setConversations(data)
      if (data.length > 0 && !selectedConv) {
        setSelectedConv(data[0].id)
      }
    }
    setLoading(false)
  }

  async function loadUsers() {
    if (!user) return
    
    const { data } = await supabase
      .from('users')
      .select('id, name, email, category')
      .eq('club_id', user.club_id)
      .neq('id', user.id)
      .eq('status', 'active')
    
    if (data) {
      setUsers(data)
    }
  }

  async function loadMessages(convId: string) {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:sender_id(name), reply_to:reply_to_id(sender:sender_id(name), content)')
      .eq('conversation_id', convId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
    
    if (data) {
      setMessages(data)
    }
  }

  async function markAsRead(convId: string) {
    if (!user) return
    
    await supabase.rpc('mark_conversation_read', {
      p_conversation_id: convId,
      p_user_id: user.id
    })
    
    // Update local state
    setConversations(prev => prev.map(c => 
      c.id === convId ? { ...c, unread_count: 0 } : c
    ))
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedConv || !newMessage.trim()) return
    
    const { data, error } = await supabase.rpc('send_message', {
      p_conversation_id: selectedConv,
      p_sender_id: user.id,
      p_content: newMessage,
      p_content_type: 'text'
    })
    
    if (!error && data) {
      setNewMessage('')
      // Optimistically add message
      const newMsg: Message = {
        id: data,
        sender_id: user.id,
        content: newMessage,
        content_type: 'text',
        created_at: new Date().toISOString(),
        sender: { name: user.name || 'Tú' },
        is_edited: false
      }
      setMessages(prev => [...prev, newMsg])
    }
  }

  async function startDirectChat(otherUserId: string) {
    if (!user) return
    
    const { data, error } = await supabase.rpc('create_direct_conversation', {
      p_club_id: user.club_id,
      p_user_a: user.id,
      p_user_b: otherUserId
    })
    
    if (!error && data) {
      setShowNewChat(false)
      loadConversations()
      setSelectedConv(data)
    }
  }

  function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Hoy'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer'
    } else {
      return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    )
  }

  const selectedConversation = conversations.find(c => c.id === selectedConv)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Chat" />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow h-[calc(100vh-200px)] flex">
          {/* Conversations List */}
          <div className="w-80 border-r flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-semibold">Conversaciones</h2>
              <button
                onClick={() => setShowNewChat(true)}
                className="text-blue-600 hover:bg-blue-50 p-2 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {conversations.length > 0 ? (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv.id)}
                    className={`w-full p-4 text-left border-b hover:bg-gray-50 transition-colors ${
                      selectedConv === conv.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium truncate">
                        {conv.is_group 
                          ? conv.name 
                          : conv.other_participant_name || 'Chat'
                        }
                      </h3>
                      {conv.last_message_at && (
                        <span className="text-xs text-gray-400">
                          {formatDate(conv.last_message_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {conv.last_message_preview || 'Sin mensajes'}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {conv.unread_count} nuevo{conv.unread_count > 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">No tienes conversaciones</p>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Header */}
                <div className="p-4 border-b">
                  <h2 className="font-semibold">
                    {selectedConversation.is_group 
                      ? selectedConversation.name 
                      : selectedConversation.other_participant_name
                    }
                  </h2>
                  {selectedConversation.is_group && selectedConversation.description && (
                    <p className="text-sm text-gray-500">{selectedConversation.description}</p>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length > 0 ? (
                    messages.map((msg, index) => {
                      const isMe = msg.sender_id === user?.id
                      const showDate = index === 0 || 
                        new Date(msg.created_at).toDateString() !== 
                        new Date(messages[index - 1].created_at).toDateString()
                      
                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="text-center my-4">
                              <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                                {formatDate(msg.created_at)}
                              </span>
                            </div>
                          )}
                          
                          <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-100'} rounded-lg px-4 py-2`}>
                              {!isMe && (
                                <p className="text-xs font-medium mb-1 opacity-75">
                                  {msg.sender?.name}
                                </p>
                              )}
                              
                              {msg.reply_to && (
                                <div className={`text-xs mb-2 p-2 rounded ${isMe ? 'bg-blue-700' : 'bg-gray-200'}`}>
                                  <p className="font-medium">{msg.reply_to.sender?.name}</p>
                                  <p className="truncate">{msg.reply_to.content}</p>
                                </div>
                              )}
                              
                              <p>{msg.content}</p>
                              <p className={`text-xs mt-1 ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                                {formatTime(msg.created_at)}
                                {msg.is_edited && ' • Editado'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-center text-gray-400 py-8">
                      No hay mensajes. ¡Empezá la conversación!
                    </p>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={sendMessage} className="p-4 border-t">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escribí un mensaje..."
                      className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Enviar
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-400">Seleccioná una conversación</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-bold mb-4">Nuevo Chat</h2>
            
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-2">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startDirectChat(u.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 rounded-lg text-left"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-sm text-gray-500">{u.category}° Categoría</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <button
              onClick={() => setShowNewChat(false)}
              className="mt-4 w-full bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
