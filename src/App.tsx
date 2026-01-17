function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4">📧 Email Forwarder Bot</h1>
        <p className="text-gray-400 mb-8">
          Bot Telegram untuk meneruskan email ke approved users.
        </p>
        <div className="bg-gray-800 rounded-lg p-6 text-left">
          <h2 className="text-xl font-semibold mb-4">🚀 Cara Menjalankan</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Clone repo ini ke VPS</li>
            <li>Copy <code className="bg-gray-700 px-1 rounded">config.env.example</code> ke <code className="bg-gray-700 px-1 rounded">config.env</code></li>
            <li>Isi konfigurasi di <code className="bg-gray-700 px-1 rounded">config.env</code></li>
            <li>Install dependencies: <code className="bg-gray-700 px-1 rounded">pip install -r requirements.txt</code></li>
            <li>Jalankan: <code className="bg-gray-700 px-1 rounded">python main.py</code></li>
          </ol>
        </div>
        <div className="mt-6 bg-gray-800 rounded-lg p-6 text-left">
          <h2 className="text-xl font-semibold mb-4">📋 Commands Bot</h2>
          <ul className="space-y-1 text-gray-300 text-sm">
            <li><code className="text-green-400">/start</code> - Mulai bot</li>
            <li><code className="text-green-400">/myid</code> - Lihat ID Telegram</li>
            <li><code className="text-green-400">/status</code> - Cek status bot</li>
            <li><code className="text-yellow-400">/adduser &lt;id&gt;</code> - Tambah user permanen (owner)</li>
            <li><code className="text-yellow-400">/addakses &lt;id&gt; &lt;hari&gt;</code> - Tambah user dengan durasi (owner)</li>
            <li><code className="text-yellow-400">/removeuser &lt;id&gt;</code> - Hapus user (owner)</li>
            <li><code className="text-yellow-400">/listusers</code> - Lihat daftar users (owner)</li>
            <li><code className="text-yellow-400">/broadcast &lt;pesan&gt;</code> - Kirim pesan ke semua (owner)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default App
