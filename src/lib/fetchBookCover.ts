import { requestQueue } from './requestQueue'
import { cacheManager } from './cacheManager'

export interface BookInfo {
  isbn: string
  title?: string
  authors?: string[]
  publisher?: string
  publishDate?: string
  description?: string
  pageCount?: number
  language?: string
  coverUrl?: string
}

export interface CoverData {
  buffer: Buffer
  contentType: string
}

export interface BookData {
  info: BookInfo
  cover: CoverData
}

export async function fetchBookData(isbn: string): Promise<BookData> {
  const coverData = await fetchBookCover(isbn)
  const bookInfo = await fetchBookInfo(isbn)
  
  return {
    info: {
      isbn,
      ...bookInfo
    },
    cover: coverData
  }
}

export async function fetchBookCover(isbn: string): Promise<CoverData> {
  const cached = await cacheManager.get(isbn)
  if (cached) {
    console.log(`Cache hit for ISBN: ${isbn}`)
    return {
      buffer: cached.buffer,
      contentType: cached.contentType
    }
  }

  console.log(`Cache miss for ISBN: ${isbn}, fetching from sources...`)
  
  const coverData = await requestQueue.process(isbn, async () => {
    try {
      const openLibraryUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
      const openLibraryResponse = await fetch(openLibraryUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })

      if (openLibraryResponse.ok) {
        const buffer = await openLibraryResponse.arrayBuffer()
        const coverData = {
          buffer: Buffer.from(buffer),
          contentType: openLibraryResponse.headers.get('content-type') || 'image/jpeg',
        }
        await cacheManager.set(isbn, coverData.buffer, coverData.contentType)
        return coverData
      }
    } catch (error) {
      console.error('Error fetching from OpenLibrary:', error)
    }

    try {
      const doubanUrl = `https://book.douban.com/isbn/${isbn}/`
      const doubanResponse = await fetch(doubanUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://book.douban.com/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Connection': 'keep-alive',
        },
      })

      if (doubanResponse.ok) {
        const html = await doubanResponse.text()
        const imgMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*alt="[^"]*"/)
        
        if (imgMatch && imgMatch[1]) {
          let imgUrl = imgMatch[1]
          if (imgUrl.startsWith('//')) {
            imgUrl = 'https:' + imgUrl
          }

          const imgResponse = await fetch(imgUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': doubanUrl,
              'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
              'Connection': 'keep-alive',
            },
          })

          if (imgResponse.ok) {
            const buffer = await imgResponse.arrayBuffer()
            const coverData = {
              buffer: Buffer.from(buffer),
              contentType: imgResponse.headers.get('content-type') || 'image/jpeg',
            }
            await cacheManager.set(isbn, coverData.buffer, coverData.contentType)
            return coverData
          }
        }
      }
    } catch (error) {
      console.error('Error fetching from Douban:', error)
    }

    try {
      const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
      const googleBooksResponse = await fetch(googleBooksUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })

      if (googleBooksResponse.ok) {
        const data = await googleBooksResponse.json()
        if (data.items && data.items.length > 0) {
          const volumeInfo = data.items[0].volumeInfo
          if (volumeInfo.imageLinks && volumeInfo.imageLinks.thumbnail) {
            const thumbnailUrl = volumeInfo.imageLinks.thumbnail
            const imgResponse = await fetch(thumbnailUrl, {
              method: 'GET',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
            })

            if (imgResponse.ok) {
              const buffer = await imgResponse.arrayBuffer()
              const coverData = {
                buffer: Buffer.from(buffer),
                contentType: imgResponse.headers.get('content-type') || 'image/jpeg',
              }
              await cacheManager.set(isbn, coverData.buffer, coverData.contentType)
              return coverData
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching from Google Books:', error)
    }

    try {
      const worldCatUrl = `https://www.worldcat.org/isbn/${isbn}`
      const worldCatResponse = await fetch(worldCatUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })

      if (worldCatResponse.ok) {
        const html = await worldCatResponse.text()
        const imgMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*alt="[^"]*cover[^"]*"/i)
        
        if (imgMatch && imgMatch[1]) {
          let imgUrl = imgMatch[1]
          if (imgUrl.startsWith('//')) {
            imgUrl = 'https:' + imgUrl
          } else if (imgUrl.startsWith('/')) {
            imgUrl = 'https://www.worldcat.org' + imgUrl
          }

          const imgResponse = await fetch(imgUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': worldCatUrl,
            },
          })

          if (imgResponse.ok) {
            const buffer = await imgResponse.arrayBuffer()
            const coverData = {
              buffer: Buffer.from(buffer),
              contentType: imgResponse.headers.get('content-type') || 'image/jpeg',
            }
            await cacheManager.set(isbn, coverData.buffer, coverData.contentType)
            return coverData
          }
        }
      }
    } catch (error) {
      console.error('Error fetching from WorldCat:', error)
    }

    throw new Error('No cover found')
  })

  return coverData
}

export async function fetchBookInfo(isbn: string): Promise<Partial<BookInfo>> {
  try {
    const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    const response = await fetch(googleBooksUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (response.ok) {
      const data = await response.json()
      if (data.items && data.items.length > 0) {
        const volumeInfo = data.items[0].volumeInfo
        return {
          title: volumeInfo.title || 'Unknown Title',
          authors: volumeInfo.authors || ['Unknown Author'],
          publisher: volumeInfo.publisher,
          publishDate: volumeInfo.publishedDate,
          description: volumeInfo.description,
          pageCount: volumeInfo.pageCount,
          language: volumeInfo.language,
          coverUrl: volumeInfo.imageLinks?.thumbnail
        }
      }
    }
  } catch (error) {
    console.error('Error fetching book info from Google Books:', error)
  }

  try {
    const openLibraryUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    const response = await fetch(openLibraryUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (response.ok) {
      const data = await response.json()
      const book = data[`ISBN:${isbn}`]
      if (book) {
        return {
          title: book.title || 'Unknown Title',
          authors: book.authors ? book.authors.map((a: any) => a.name) : ['Unknown Author'],
          publisher: book.publishers ? book.publishers[0]?.name : undefined,
          publishDate: book.publish_date,
          description: book.description?.value || book.description,
          pageCount: book.number_of_pages,
          language: book.language,
          coverUrl: book.cover?.large
        }
      }
    }
  } catch (error) {
    console.error('Error fetching book info from OpenLibrary:', error)
  }

  return {
    title: 'Unknown Title',
    authors: ['Unknown Author']
  }
}
