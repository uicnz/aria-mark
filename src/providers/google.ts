// Google Cloud Speech-to-Text provider implementation

import type { TranscriptionProvider, AudioData, ProviderConfig } from './types'

interface GoogleSpeechConfig extends ProviderConfig {
  languageCode?: string
  alternativeLanguageCodes?: string[]
}

interface GoogleErrorDetail {
  reason?: string
  domain?: string
  metadata?: Record<string, string>
}

interface GoogleSpeechResponse {
  results?: Array<{
    alternatives?: Array<{
      transcript?: string
    }>
  }>
  error?: {
    message: string
    code: number
    details?: GoogleErrorDetail[]
  }
}

export class GoogleProvider implements TranscriptionProvider {
  name = 'google'
  displayName = 'Google Cloud Speech-to-Text'
  private endpoint = 'https://speech.googleapis.com/v1/speech:recognize'

  async transcribe(audio: AudioData, config: GoogleSpeechConfig): Promise<string> {
    if (!config.apiKey) {
      throw new Error('Google Cloud API key is required')
    }

    // Convert audio to base64
    const base64Audio = await this.audioToBase64(audio.blob)

    const encoding = this.getAudioEncoding(audio.format)
    const sampleRate = this.getExpectedSampleRate(audio.format, encoding)

    const requestBody = {
      audio: {
        content: base64Audio
      },
      config: {
        languageCode: config.languageCode || 'en-US',
        alternativeLanguageCodes: config.alternativeLanguageCodes || [
          'da-DK', 'en-GB', 'de-AT', 'de-DE'
        ],
        encoding,
        ...(sampleRate && { sampleRateHertz: sampleRate }),
        audioChannelCount: 1
      }
    }

    const response = await fetch(`${this.endpoint}?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()

      // Parse the error for better user feedback
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.error?.message?.includes('has not been used') || errorData.error?.message?.includes('disabled')) {
          throw new Error(`Google Cloud Speech-to-Text API is not enabled for your project. Please enable it at: https://console.cloud.google.com/apis/library/speech.googleapis.com`)
        }
        if (errorData.error?.message?.includes('API key not valid')) {
          throw new Error(`Invalid Google Cloud API key. Please check your API key in the Google Cloud Console.`)
        }
        if (errorData.error?.message?.includes('are blocked') || errorData.error?.details?.some((d: GoogleErrorDetail) => d.reason === 'API_KEY_SERVICE_BLOCKED')) {
          throw new Error(`API key is restricted and cannot access Speech-to-Text API. Please remove API restrictions or create a new unrestricted key.`)
        }
        throw new Error(`Google Speech API error: ${errorData.error?.message || errorText}`)
      } catch (parseError) {
        throw new Error(`Google Speech API error: ${response.status} - ${errorText}`)
      }
    }

    const result: GoogleSpeechResponse = await response.json()

    if (result.error) {
      throw new Error(`Google Speech API error: ${result.error.message}`)
    }

    const transcript = result.results?.[0]?.alternatives?.[0]?.transcript

    if (!transcript) {
      throw new Error('No transcription result from Google Speech API')
    }

    return transcript.trim()
  }

  async validateConfig(config: ProviderConfig): Promise<boolean | 'restricted'> {
    if (!config.apiKey || config.apiKey.length < 20) {
      return false
    }

    try {
      // Test the API key using the operations endpoint (lightweight validation)
      const testEndpoint = `https://speech.googleapis.com/v1/operations?key=${config.apiKey}`
      const response = await fetch(testEndpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.status === 401) {
        // Invalid API key
        return false
      }

      if (response.status === 403) {
        const errorData = await response.json().catch(() => null)

        // Check for API restrictions
        if (errorData?.error?.details?.some((d: GoogleErrorDetail) => d.reason === 'API_KEY_SERVICE_BLOCKED')) {
          return 'restricted'
        }

        // Check if API is not enabled
        if (errorData?.error?.message?.includes('has not been used') || errorData?.error?.message?.includes('disabled')) {
          return 'restricted'
        }

        // Other 403 errors - treat as invalid
        return false
      }

      // Any non-error response means the key works
      return response.status < 500
    } catch (error) {
      console.error('Google validation error:', error)
      return false
    }
  }

  getSupportedFormats(): string[] {
    return [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/wav',
      'audio/flac',
      'audio/ogg',
      'audio/mp3',
      'audio/mpeg'
    ]
  }

  private async audioToBase64(audioBlob: Blob | Buffer): Promise<string> {
    if (typeof Buffer !== 'undefined' && audioBlob instanceof Buffer) {
      return audioBlob.toString('base64')
    }

    const blob = audioBlob as Blob

    // Convert Blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove data URL prefix (data:audio/webm;base64,)
          const base64 = reader.result.split(',')[1]
          resolve(base64)
        } else {
          reject(new Error('Failed to convert audio to base64'))
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  }

  private getAudioEncoding(mimeType: string): string {
    // Map MIME types to Google Cloud Speech encoding values
    if (mimeType.includes('webm')) {
      return 'WEBM_OPUS'
    }
    if (mimeType.includes('wav')) {
      return 'LINEAR16'
    }
    if (mimeType.includes('flac')) {
      return 'FLAC'
    }
    if (mimeType.includes('ogg')) {
      return 'OGG_OPUS'
    }
    if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
      return 'MP3'
    }

    // Default to WEBM_OPUS as it's commonly supported
    return 'WEBM_OPUS'
  }

  private getExpectedSampleRate(_mimeType: string, encoding: string): number | null {
    // For WEBM_OPUS and OGG_OPUS, don't specify sample rate - let Google auto-detect
    if (encoding === 'WEBM_OPUS' || encoding === 'OGG_OPUS') {
      return null
    }

    // For LINEAR16 (WAV), common sample rates are 16kHz, 44.1kHz, 48kHz
    // Let's not specify it to allow auto-detection
    if (encoding === 'LINEAR16') {
      return null
    }

    // For FLAC and MP3, also allow auto-detection
    return null
  }
}
