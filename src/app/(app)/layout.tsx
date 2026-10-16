import { TabBar } from '@/components/nav/tab-bar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:pl-60">
      <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 lg:px-8 lg:pb-12">{children}</main>
      <TabBar />
    </div>
  )
}
