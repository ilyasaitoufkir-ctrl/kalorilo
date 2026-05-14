import { useState, useRef } from 'react'

interface ISpeechRec {
  start(): void
  stop(): void
  abort(): void
  continuous: boolean
  lang: string
  interimResults: boolean
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRec
    webkitSpeechRecognition?: new () => ISpeechRec
  }
}

export function useVoice() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recRef = useRef<ISpeechRec | null>(null)

  const isSupported = !!(
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  )

  const startListening = (
    onResult: (text: string) => void,
    onError?: (msg: string) => void
  ) => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) { onError?.('Spracheingabe nicht unterstützt'); return }

    const rec = new SR()
    rec.lang = 'de-DE'
    rec.continuous = false
    rec.interimResults = false
    recRef.current = rec

    rec.onstart = () => setListening(true)
    rec.onend   = () => setListening(false)
    rec.onresult = (e: any) => {
      const text: string = e.results[0][0].transcript
      setTranscript(text)
      onResult(text)
    }
    rec.onerror = (e: any) => {
      setListening(false)
      onError?.(e.error === 'not-allowed' ? 'Mikrofon-Zugriff verweigert' : 'Erkennungsfehler')
    }

    try { rec.start() } catch { setListening(false) }
  }

  const stopListening = () => {
    recRef.current?.abort()
    setListening(false)
  }

  return { listening, transcript, startListening, stopListening, isSupported }
}
