class RequestQueue {
  private queue: Array<{
    isbn: string
    resolve: (result: any) => void
    reject: (error: any) => void
    fetchFn: () => Promise<any>
    retries: number
  }> = []
  private processing = new Set<string>()
  private maxConcurrent = 1
  private activeRequests = 0
  private lastRequestTime = 0
  private retryCount = new Map<string, number>()
  private dataSourceHealth = new Map<string, { healthy: boolean; backoffUntil: number }>()

  async process(isbn: string, fetchFn: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.processing.has(isbn)) {
        this.queue.push({ isbn, resolve, reject, fetchFn, retries: 0 })
        return
      }

      this.processing.add(isbn)
      this.processRequest(isbn, fetchFn, resolve, reject, 0)
    })
  }

  private async processRequest(isbn: string, fetchFn: () => Promise<any>, resolve: (result: any) => void, reject: (error: any) => void, retries: number) {
    if (this.activeRequests >= this.maxConcurrent) {
      this.queue.push({ isbn, resolve, reject, fetchFn, retries })
      return
    }

    await this.enforceRateLimit()
    this.activeRequests++
    
    try {
      const result = await fetchFn()
      this.resetRetryCount(isbn)
      resolve(result)
    } catch (error: any) {
      const maxRetries = 3
      
      if (retries< maxRetries) {
        const backoffTime = this.calculateBackoff(retries)
        console.log(`Retrying ${isbn} in ${backoffTime}ms (attempt ${retries + 1}/${maxRetries})`)
        
        setTimeout(() =>{
          this.processRequest(isbn, fetchFn, resolve, reject, retries + 1)
        }, backoffTime)
      } else {
        console.error(`Failed to fetch ${isbn} after ${maxRetries} retries:`, error)
        reject(error)
      }
    } finally {
      this.activeRequests--
      this.processing.delete(isbn)
      this.lastRequestTime = Date.now()
      this.processNext()
    }
  }

  private async enforceRateLimit() {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    const minInterval = 1000 
    if (elapsed< minInterval) {
      const waitTime = minInterval - elapsed
      console.log(`Rate limiting: waiting ${waitTime}ms`)
      await new Promise(resolve =>setTimeout(resolve, waitTime))
    }
  }

  private calculateBackoff(retryCount: number): number {
    const baseDelay = 1000
    const maxDelay = 30000
    return Math.min(baseDelay * Math.pow(2, retryCount) + Math.random() * 1000, maxDelay)
  }

  private resetRetryCount(isbn: string) {
    this.retryCount.delete(isbn)
  }

  private processNext() {
    if (this.queue.length === 0 || this.activeRequests >= this.maxConcurrent) {
      return
    }

    const next = this.queue.shift()
    if (next) {
      this.processRequest(next.isbn, next.fetchFn, next.resolve, next.reject, next.retries)
    }
  }
}

export const requestQueue = new RequestQueue()
