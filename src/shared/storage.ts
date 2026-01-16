// Universal storage for provider configurations
// Handles both browser localStorage and CLI file-based storage

import type { ProviderConfig, ProviderType } from '../providers/types'

const isTerminal = typeof window === 'undefined'

export class UniversalStorage {
  private storagePrefix = 'aria-mark-provider-'

  // Get provider configuration
  getProviderConfig(provider: ProviderType): ProviderConfig | null {
    if (isTerminal) {
      return this.getConfigFromFile(provider)
    } else {
      return this.getConfigFromLocalStorage(provider)
    }
  }

  // Set provider configuration
  setProviderConfig(provider: ProviderType, config: ProviderConfig): void {
    if (isTerminal) {
      this.setConfigToFile(provider, config)
    } else {
      this.setConfigToLocalStorage(provider, config)
    }
  }

  // Remove provider configuration
  removeProviderConfig(provider: ProviderType): void {
    if (isTerminal) {
      this.removeConfigFromFile(provider)
    } else {
      this.removeConfigFromLocalStorage(provider)
    }
  }

  // Get all configured providers
  getConfiguredProviders(): ProviderType[] {
    if (isTerminal) {
      return this.getConfiguredProvidersFromFile()
    } else {
      return this.getConfiguredProvidersFromLocalStorage()
    }
  }

  // Browser storage methods
  private getConfigFromLocalStorage(provider: ProviderType): ProviderConfig | null {
    const stored = localStorage.getItem(this.storagePrefix + provider)
    if (!stored) return null

    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }

  private setConfigToLocalStorage(provider: ProviderType, config: ProviderConfig): void {
    localStorage.setItem(this.storagePrefix + provider, JSON.stringify(config))
  }

  private removeConfigFromLocalStorage(provider: ProviderType): void {
    localStorage.removeItem(this.storagePrefix + provider)
  }

  private getConfiguredProvidersFromLocalStorage(): ProviderType[] {
    const providers: ProviderType[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.storagePrefix)) {
        const provider = key.replace(this.storagePrefix, '') as ProviderType
        providers.push(provider)
      }
    }
    return providers
  }

  // CLI storage methods (placeholders for now)
  private getConfigFromFile(_provider: ProviderType): ProviderConfig | null {
    console.warn('CLI storage not yet implemented')
    return null
  }

  private setConfigToFile(_provider: ProviderType, _config: ProviderConfig): void {
    console.warn('CLI storage not yet implemented')
  }

  private removeConfigFromFile(_provider: ProviderType): void {
    console.warn('CLI storage not yet implemented')
  }

  private getConfiguredProvidersFromFile(): ProviderType[] {
    console.warn('CLI storage not yet implemented')
    return []
  }
}
