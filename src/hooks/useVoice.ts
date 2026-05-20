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
    // HTTPS-Prüfung – Web Speech API braucht Secure Context (außer localhost)
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      onError?.('Spracheingabe benötigt HTTPS. Bitte https:// Adresse verwenden.')
      return
    }

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) {
      onError?.('Spracheingabe wird auf diesem Gerät nicht unterstützt. Bitte Safari nutzen.')
      return
    }

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
      const errMap: Record<string, string> = {
        'not-allowed':  'Mikrofon-Zugriff verweigert. Einstellungen → Safari → Mikrofon erlauben.',
        'no-speech':    'Keine Sprache erkannt. Bitte nochmal versuchen.',
        'network':      'Netzwerkfehler bei der Spracherkennung.',
        'aborted':      '',   // user aborted = kein Fehler
        'audio-capture':'Kein Mikrofon gefunden.',
        'service-not-allowed': 'Mikrofon-Zugriff verweigert.',
      }
      const msg = errMap[e.error] ?? `Fehler: ${e.error}`
      if (msg) onError?.(msg)
    }

    try {
      rec.start()
    } catch (e: any) {
      setListening(false)
      onError?.(e?.message ?? 'Spracheingabe konnte nicht gestartet werden.')
    }
  }

  const stopListening = () => {
    recRef.current?.abort()
    setListening(false)
  }

  return { listening, transcript, startListening, stopListening, isSupported }
}
