export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">图书封面API</h1>
        <p className="text-gray-600 mb-8">
          使用方式: /api/cover/[ISBN]
        </p>
        <div className="bg-white p-6 rounded-lg shadow-md max-w-md mx-auto">
          <h2 className="text-xl font-semibold mb-4">示例</h2>
          <p className="text-gray-700 mb-2">获取图书封面:</p>
          <code className="block bg-gray-100 p-3 rounded text-sm overflow-x-auto">
            https://your-vercel-project.vercel.app/api/cover/9787544270878
          </code>
        </div>
      </div>
    </main>
  )
}
