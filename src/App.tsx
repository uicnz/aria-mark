import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { Editor } from '@/components/editor'

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Editor />
      <Toaster />
    </ThemeProvider>
  )
}

export default App
