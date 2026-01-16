import { useState, useEffect, useRef, useCallback } from 'react'
import MDEditor from '@uiw/react-md-editor'
import { useTheme } from 'next-themes'
import { Eye, Split, Code, Eclipse, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { encodeContent, decodeContent, type PreviewMode } from '@/shared/compression'
import { Recorder } from '@/components/recorder'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const URL_CHAR_LIMIT = 16000
const DEBOUNCE_MS = 1000

export function Editor() {
  const [content, setContent] = useState('')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('edit')
  const [urlUsage, setUrlUsage] = useState(0)
  const [isLimitReached, setIsLimitReached] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cursorPositionRef = useRef<number>(0)
  const isInitializedRef = useRef(false)

  // Load content from URL on mount
  useEffect(() => {
    const loadFromUrl = async () => {
      const hash = window.location.hash.slice(1)
      if (hash) {
        try {
          const data = await decodeContent(hash)
          setContent(data.content)
          setPreviewMode(data.mode)
        } catch (error) {
          console.error('Failed to decode URL content:', error)
        }
      }
      isInitializedRef.current = true
    }

    loadFromUrl()
  }, [])

  // Save content to URL with debounce
  const saveToUrl = useCallback(async (text: string, mode: PreviewMode) => {
    if (!isInitializedRef.current) return

    try {
      const encoded = await encodeContent(text, mode)
      const newUrl = encoded ? `#${encoded}` : window.location.pathname

      // Calculate URL usage
      const totalLength = window.location.origin.length + window.location.pathname.length + newUrl.length
      const usage = (totalLength / URL_CHAR_LIMIT) * 100
      setUrlUsage(usage)
      setIsLimitReached(usage >= 100)

      // Update URL without reload
      if (totalLength < URL_CHAR_LIMIT) {
        window.history.pushState(null, '', newUrl)
      }

      // Update page title from first line
      const firstLine = text.split('\n')[0]?.replace(/^#*\s*/, '').trim() || 'AriaMark'
      document.title = firstLine.slice(0, 50) || 'AriaMark'
    } catch (error) {
      console.error('Failed to save to URL:', error)
    }
  }, [])

  // Handle content change with debounce
  const handleContentChange = useCallback((value: string | undefined) => {
    const newContent = value || ''
    setContent(newContent)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      saveToUrl(newContent, previewMode)
    }, DEBOUNCE_MS)
  }, [previewMode, saveToUrl])

  // Handle mode change
  const cycleMode = useCallback(() => {
    const modes: PreviewMode[] = ['edit', 'live', 'view']
    const currentIndex = modes.indexOf(previewMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setPreviewMode(nextMode)
    saveToUrl(content, nextMode)
  }, [previewMode, content, saveToUrl])

  // Keyboard shortcut for mode toggle (Cmd+E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        cycleMode()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [cycleMode])

  // Capture cursor position
  const handleCaptureCursor = () => {
    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement
    if (textarea) {
      cursorPositionRef.current = textarea.selectionStart || content.length
    }
  }

  // Handle transcription insertion
  const handleTranscription = (text: string) => {
    const position = cursorPositionRef.current
    const before = content.slice(0, position)
    const after = content.slice(position)
    const space = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : ''
    const newContent = `${before}${space}${text}${after}`

    setContent(newContent)
    saveToUrl(newContent, previewMode)

    // Restore focus and cursor
    setTimeout(() => {
      const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement
      if (textarea) {
        textarea.focus()
        const newPosition = position + space.length + text.length
        textarea.setSelectionRange(newPosition, newPosition)
        cursorPositionRef.current = newPosition
      }
    }, 100)
  }

  // Trigger save before recording
  const handleRecordingStart = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    saveToUrl(content, previewMode)
  }

  const modeIcon = {
    edit: <Code className="size-4" />,
    live: <Split className="size-4" />,
    view: <Eye className="size-4" />,
  }[previewMode]

  const mdEditorPreview = {
    edit: 'edit',
    live: 'live',
    view: 'preview',
  }[previewMode] as 'edit' | 'live' | 'preview'

  return (
    <div className="h-screen w-full overflow-hidden">
      <div className="relative h-full w-full overflow-hidden" data-color-mode={resolvedTheme === 'dark' ? 'dark' : 'light'}>
        <MDEditor
          value={content}
          onChange={handleContentChange}
          preview={mdEditorPreview}
          hideToolbar
          visibleDragbar={false}
          height="100%"
          className="!h-full !border-none !bg-transparent"
          textareaProps={{
            placeholder: 'Start typing...',
          }}
        />

        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <Recorder
            onTranscription={handleTranscription}
            onRecordingStart={handleRecordingStart}
            onCaptureCursor={handleCaptureCursor}
          />

          <Button
            variant="outline"
            size="icon-sm"
            onClick={cycleMode}
            title={`Mode: ${previewMode} (Cmd+E)`}
          >
            {modeIcon}
          </Button>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            <Eclipse className="size-4" />
          </Button>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <Popover>
            <PopoverTrigger
              render={
                <Badge
                  variant="secondary"
                  className={cn(
                    'tabular-nums cursor-help transition-colors',
                    urlUsage < 50 && 'bg-green-500/20 text-green-700 dark:text-green-400',
                    urlUsage >= 50 && urlUsage < 75 && 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
                    urlUsage >= 75 && urlUsage < 100 && 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
                    urlUsage >= 100 && 'bg-red-500/20 text-red-700 dark:text-red-400'
                  )}
                >
                  {urlUsage.toFixed(2)}%
                </Badge>
              }
            />
            <PopoverContent align="end" className="w-64 text-sm">
              <p className="font-medium mb-2">URL Storage Usage</p>
              <p className="text-muted-foreground">
                Your content is stored in the URL. This shows how much of the {URL_CHAR_LIMIT.toLocaleString()} character limit you're using.
              </p>
              {isLimitReached && (
                <p className="text-destructive mt-2">
                  Limit reached. Additional content won't be saved to the URL.
                </p>
              )}
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={async () => {
              const url = window.location.href
              if (navigator.share) {
                try {
                  await navigator.share({ url })
                } catch {
                  // User cancelled or share failed, fall back to clipboard
                  await navigator.clipboard.writeText(url)
                  toast('Link copied')
                }
              } else {
                await navigator.clipboard.writeText(url)
                toast('Link copied')
              }
            }}
            title="Share link"
          >
            <Share2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Editor
