export interface CoverData {
  buffer: Buffer
  contentType: string
}

export async function fetchBookCover(isbn: string): Promise<CoverData> {
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
      return {
        buffer: Buffer.from(buffer),
        contentType: openLibraryResponse.headers.get('content-type') || 'image/jpeg',
      }
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
      },
    })

    if (doubanResponse.ok) {
      const html = await doubanResponse.text()
      const imgMatch = html.match(/<img[^>]+src="([^"]+)"[^>]+class="nbg"/)
      
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
          },
        })

        if (imgResponse.ok) {
          const buffer = await imgResponse.arrayBuffer()
          return {
            buffer: Buffer.from(buffer),
            contentType: imgResponse.headers.get('content-type') || 'image/jpeg',
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching from Douban:', error)
  }

  throw new Error('No cover found')
}
