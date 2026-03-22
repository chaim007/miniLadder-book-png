import fs from 'fs/promises'
import path from 'path'

export interface CacheItem {
  buffer: Buffer
  contentType: string
  timestamp: number
}

class CacheManager {
  private cacheDir: string
  private maxCacheSize = 100 * 1024 * 1024 
  private cacheTTL = 24 * 60 * 60 * 1000 

  constructor() {
    this.cacheDir = path.join(process.cwd(), 'cache')
    this.ensureCacheDir()
  }

  private async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create cache directory:', error)
    }
  }

  async get(isbn: string): Promise<CacheItem | null> {
    try {
      const filePath = path.join(this.cacheDir, `${isbn}.json`)
      const data = await fs.readFile(filePath, 'utf8')
      const item = JSON.parse(data)
      
      if (Date.now() - item.timestamp > this.cacheTTL) {
        await this.delete(isbn)
        return null
      }
      
      return {
        ...item,
        buffer: Buffer.from(item.buffer, 'base64')
      }
    } catch (error) {
      return null
    }
  }

  async set(isbn: string, buffer: Buffer, contentType: string): Promise<void> {
    try {
      const item: CacheItem = {
        buffer,
        contentType,
        timestamp: Date.now()
      }
      
      const filePath = path.join(this.cacheDir, `${isbn}.json`)
      await fs.writeFile(filePath, JSON.stringify({
        ...item,
        buffer: buffer.toString('base64')
      }))
      
      await this.cleanup()
    } catch (error) {
      console.error('Failed to write cache:', error)
    }
  }

  async delete(isbn: string): Promise<void> {
    try {
      const filePath = path.join(this.cacheDir, `${isbn}.json`)
      await fs.unlink(filePath)
    } catch (error) {
      // Ignore errors when deleting
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir)
      let totalSize = 0
      const fileInfos: Array<{ name: string; mtime: number; size: number }> = []

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file)
        const stats = await fs.stat(filePath)
        totalSize += stats.size
        fileInfos.push({
          name: file,
          mtime: stats.mtime.getTime(),
          size: stats.size
        })
      }

      if (totalSize > this.maxCacheSize) {
        fileInfos.sort((a, b) => a.mtime - b.mtime)
        
        while (totalSize > this.maxCacheSize * 0.8 && fileInfos.length > 0) {
          const oldest = fileInfos.shift()
          if (oldest) {
            await fs.unlink(path.join(this.cacheDir, oldest.name))
            totalSize -= oldest.size
          }
        }
      }
    } catch (error) {
      console.error('Cache cleanup failed:', error)
    }
  }
}

export const cacheManager = new CacheManager()
