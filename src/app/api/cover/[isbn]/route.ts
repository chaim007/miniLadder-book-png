import { NextRequest, NextResponse } from 'next/server'
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { fetchBookCover } from '@/lib/fetchBookCover'

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
    if (s3Client && bucketName) {
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      })

      try {
        const headResponse = await s3Client.send(headCommand)
        console.log(`File ${key} already exists in S3, redirecting...`)
        const url = `${process.env.B2_ENDPOINT}/${bucketName}/${key}`
        return NextResponse.redirect(url)
      } catch (error: any) {
        if (error.name === 'NotFound') {
          console.log(`File ${key} not found in S3, proceeding to upload...`)
        } else {
          console.warn(`Error checking file existence in S3:`, error)
        }
      }
    }

    const coverData = await fetchBookCover(isbn)
    
    if (s3Client && bucketName) {
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
        if (error.name === 'NoSuchBucket') {
          console.error(`Bucket ${bucketName} does not exist`)
        } else if (error.name === 'InvalidAccessKeyId') {
          console.error('Invalid S3 credentials')
        } else {
          console.warn(`Failed to upload ${key} to S3, returning cover directly:`, error)
        }
      }
    }

    const response = new NextResponse(coverData.buffer, {
      status: 200,
      headers: {
        'Content-Type': coverData.contentType,
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
