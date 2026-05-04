export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FBF7F1] p-4">
      {children}
    </main>
  )
}
