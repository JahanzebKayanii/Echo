import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../api'

export default function ChatPanel({ meetingId }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    fetchHistory()
  }, [meetingId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchHistory() {
    const res = await apiFetch(`/meetings/${meetingId}/chat`)
    const data = await res.json()
    setMessages(data)
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userText = input.trim()
    setInput('')
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: userText, id: Date.now() }])

    const res = await apiFetch(`/meetings/${meetingId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText }),
    })
    const data = await res.json()
    setLoading(false)
    setMessages(prev => [...prev, { role: 'assistant', content: data.response, id: Date.now() + 1 }])
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">Ask anything about this meeting — action items, decisions, what someone said...</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={`chat-message chat-${m.role}`}>
            <span className="chat-role">{m.role === 'user' ? 'You' : 'Echo AI'}</span>
            <p>{m.content}</p>
          </div>
        ))}
        {loading && (
          <div className="chat-message chat-assistant">
            <span className="chat-role">Echo AI</span>
            <p className="chat-thinking">Thinking...</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-row" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Ask about this meeting..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
