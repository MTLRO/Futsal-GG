import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-primary mb-2">404</h2>
        <p className="text-xl text-muted-foreground mb-6">Page not found</p>
        <Link href="/">
          <Button>Return Home</Button>
        </Link>
      </div>
    </div>
  )
}
