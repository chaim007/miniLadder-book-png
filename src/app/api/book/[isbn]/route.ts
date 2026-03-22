import { NextRequest, NextResponse } from 'next/server'
import { fetchBookData } from '@/lib/fetchBookCover'

export async function GET(request: NextRequest, { params }: { params: { isbn: string } }) {
  const { isbn } = params

  try {
    const bookData = await fetchBookData(isbn)
    
    return NextResponse.json({
      success: true,
      data: {
        info: bookData.info,
        cover: {
          contentType: bookData.cover.contentType,
          base64: bookData.cover.buffer.toString('base64')
        }
      }
    }, {
      headers: {
        'Cache-Control': 'public, max-age=86400',
      }
    })
  } catch (error) {
    console.error('Error fetching book data:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch book data'
    }, {
      status: 500
    })
  }
}
