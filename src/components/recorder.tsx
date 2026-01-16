import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { createProvider, availableProviders, type ProviderType, type TranscriptionProvider } from '@/providers'
import { UniversalStorage } from '@/shared/storage'
import type { AudioData, ProviderConfig } from '@/providers/types'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface RecorderProps {
  onTranscription?: (text: string) => void
  onRecordingStart?: () => void
  onCaptureCursor?: () => void
}

type ConfigStatus = 'idle' | 'validating' | 'valid' | 'invalid' | 'restricted'

const storage = new UniversalStorage()

export function Recorder({ onTranscription, onRecordingStart, onCaptureCursor }: RecorderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('openai')
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null)
  const [configStatus, setConfigStatus] = useState<ConfigStatus>('idle')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [provider, setProvider] = useState<TranscriptionProvider | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const recordingToastId = useRef<string | number | null>(null)

  // Initialize provider
  useEffect(() => {
    const init = async () => {
      try {
        const newProvider = await createProvider(selectedProvider)
        setProvider(newProvider)

        const config = storage.getProviderConfig(selectedProvider)
        if (config) {
          setProviderConfig(config)
          validateConfig(config, newProvider)
        } else {
          setProviderConfig(null)
          setConfigStatus('idle')
        }
      } catch (error) {
        console.error('Failed to initialize provider:', error)
        setProvider(null)
      }
    }

    init()
  }, [selectedProvider])

  // Validate provider config
  const validateConfig = useCallback(async (config: ProviderConfig, providerInstance?: TranscriptionProvider) => {
    if (!config.apiKey) {
      setConfigStatus('idle')
      return
    }

    setConfigStatus('validating')
    try {
      const currentProvider = providerInstance || provider
      if (currentProvider) {
        const result = await currentProvider.validateConfig(config)

        if (result === true) {
          setConfigStatus('valid')
          storage.setProviderConfig(selectedProvider, config)
        } else if (result === 'restricted') {
          setConfigStatus('restricted')
          storage.setProviderConfig(selectedProvider, config)
        } else {
          setConfigStatus('invalid')
          storage.removeProviderConfig(selectedProvider)
        }
      }
    } catch (error) {
      console.error('Config validation failed:', error)
      setConfigStatus('invalid')
      storage.removeProviderConfig(selectedProvider)
    }
  }, [provider, selectedProvider])

  // Handle API key change
  const handleApiKeyChange = (value: string) => {
    const newConfig: ProviderConfig = { ...providerConfig, apiKey: value }
    setProviderConfig(newConfig)

    if (value.length === 0) {
      setConfigStatus('idle')
      storage.removeProviderConfig(selectedProvider)
    } else {
      validateConfig(newConfig)
    }
  }

  // Get supported audio format
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg'
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    return undefined
  }

  // Start recording
  const startRecording = async () => {
    try {
      onRecordingStart?.()

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedMimeType()
      const options = mimeType ? { mimeType } : undefined

      const recorder = new MediaRecorder(stream, options)
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = async () => {
        const actualMimeType = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunks, { type: actualMimeType })
        await transcribeAudio(blob)
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)

      recordingToastId.current = toast('Recording...', {
        description: 'Click again to stop',
        duration: Infinity,
      })
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Microphone access denied')
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop()
      setIsRecording(false)
      setMediaRecorder(null)

      if (recordingToastId.current) {
        toast.dismiss(recordingToastId.current)
        recordingToastId.current = null
      }

      toast('Processing...', { duration: 2000 })
    }
  }

  // Handle mic button click
  const handleMicClick = () => {
    if (configStatus !== 'valid' && configStatus !== 'restricted') {
      toast.error('Configure API key first')
      return
    }

    if (isTranscribing) return

    onCaptureCursor?.()

    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // Transcribe audio
  const transcribeAudio = useCallback(async (blob: Blob) => {
    if ((configStatus !== 'valid' && configStatus !== 'restricted') || !providerConfig || !provider) {
      return
    }

    setIsTranscribing(true)

    try {
      const audioData: AudioData = { blob, format: blob.type }
      const transcription = await provider.transcribe(audioData, providerConfig)

      if (transcription?.trim()) {
        setTimeout(() => onTranscription?.(transcription.trim()), 50)
      }
    } catch (error) {
      console.error('Transcription error:', error)
      toast.error('Transcription failed')
    } finally {
      setIsTranscribing(false)
    }
  }, [providerConfig, configStatus, provider, onTranscription])

  // Keyboard shortcut (Cmd+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleMicClick()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [configStatus, isTranscribing, isRecording])

  const statusColor = {
    idle: 'border-muted-foreground/30',
    validating: 'border-yellow-500',
    valid: 'border-green-500',
    invalid: 'border-red-500',
    restricted: 'border-orange-500',
  }[configStatus]

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={isRecording ? 'default' : 'outline'}
        size="icon-sm"
        onClick={handleMicClick}
        disabled={isTranscribing}
        className={cn(
          isRecording && 'animate-pulse bg-red-500 hover:bg-red-600',
          isTranscribing && 'opacity-50'
        )}
      >
        {isTranscribing ? (
          <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Mic className="size-4" />
        )}
      </Button>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="icon-sm">
              <Settings className="size-4" />
            </Button>
          }
        />
        <PopoverContent align="end" className="w-72" data-1p-ignore data-lpignore="true" data-bwignore data-protonpass-ignore>
          <div className="space-y-3" data-form-type="other">
            <Select
              value={selectedProvider}
              onValueChange={(v) => setSelectedProvider(v as ProviderType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start">
                {Object.entries(availableProviders).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div data-1p-ignore data-lpignore="true" data-bwignore data-protonpass-ignore>
              <Input
                ref={inputRef}
                id="aria-mark-token"
                name="aria-mark-token"
                type="text"
                value={providerConfig?.apiKey || ''}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                onFocus={() => setShowApiKey(true)}
                onBlur={() => setShowApiKey(false)}
                placeholder={availableProviders[selectedProvider].configFields[0]?.placeholder}
                className={cn(
                  'transition-colors',
                  statusColor,
                  !showApiKey && providerConfig?.apiKey && 'text-security-disc'
                )}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-autocomplete="none"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                data-protonpass-ignore
                data-form-type="other"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default Recorder
