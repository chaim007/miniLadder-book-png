import { NextRequest, NextResponse } from 'next/server'
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { fetchBookCover } from '@/lib/fetchBookCover'

const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
  region: 'us-west-004',
})

export async function GET(request: NextRequest, { params }: { params: { isbn: string } }) {
  const { isbn } = params
  const bucketName = process.env.B2_BUCKET_NAME!

  try {
    const headCommand = new HeadObjectCommand({
      Bucket: bucketName,
      Key: `${isbn}.jpg`,
    })

    try {
      await s3Client.send(headCommand)
      const url = `${process.env.B2_ENDPOINT}/${bucketName}/${isbn}.jpg`
      return NextResponse.redirect(url)
    } catch (error) {
    }

    const coverData = await fetchBookCover(isbn)
    
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: `${isbn}.jpg`,
      Body: coverData.buffer,
      ContentType: coverData.contentType,
    })

    await s3Client.send(putCommand)

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
