import { NextRequest, NextResponse } from 'next/server'
import { S3Client, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { fetchBookCover } from '@/lib/fetchBookCover'
import type { CoverData } from '@/lib/fetchBookCover'

let s3Client: S3Client | null = null
try {
  s3Client = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.B2_KEY_ID!,
      secretAccessKey: process.env.B2_APPLICATION_KEY!,
    },
    region: 'us-west-004',
  })
} catch (error) {
  console.warn('S3 client initialization failed, will skip S3 operations')
}

export async function GET(request: NextRequest, { params }: { params: { isbn: string } }) {
  const { isbn } = params
  const bucketName = process.env.B2_BUCKET_NAME!
  const key = `${isbn}.jpg`

  try {
    let coverData: CoverData
    
    if (s3Client && bucketName) {
      try {
        const getCommand = new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
        
        const getResponse = await s3Client.send(getCommand)
        console.log(`File ${key} found in S3, returning from cache...`)
        
        const buffer = await getResponse.Body?.transformToByteArray()
        if (buffer) {
          coverData = {
            buffer: Buffer.from(buffer),
            contentType: getResponse.ContentType || 'image/jpeg',
          }
        } else {
          throw new Error('Empty response from S3')
        }
      } catch (error: any) {
        if (error.name === 'NotFound') {
          console.log(`File ${key} not found in S3, fetching from sources...`)
          coverData = await fetchBookCover(isbn)
          
          const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: coverData.buffer,
            ContentType: coverData.contentType,
          })

          try {
            await s3Client.send(putCommand)
            console.log(`Successfully uploaded ${key} to S3`)
          } catch (error: any) {
            console.warn(`Failed to upload ${key} to S3, but returning cover anyway:`, error)
          }
        } else {
          console.warn(`Error accessing S3:`, error)
          coverData = await fetchBookCover(isbn)
        }
      }
    } else {
      coverData = await fetchBookCover(isbn)
    }

    const response = new NextResponse(coverData.buffer, {
      status: 200,
      headers: {
        'Content-Type': coverData.contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })

    return response
  } catch (error) {
    console.error('Error fetching book cover:', error)
    const placeholderSvg = generatePlaceholderSvg()
    return new NextResponse(placeholderSvg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
      },
    })
  }
}

function generatePlaceholderSvg(): string {
  return `
    <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="300" fill="#f3f4f6"/>
      <text x="100" y="150" font-family="Arial" font-size="14" text-anchor="middle" fill="#6b7280">暂无封面</text>
    </svg>
  `.trim()
}
