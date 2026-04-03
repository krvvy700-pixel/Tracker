'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      router.push('/admin');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="loading-center" style={{ minHeight: '100vh' }}>
      <Loader2 size={32} className="spinner-lg" style={{ border: 'none', animation: 'spin 0.6s linear infinite', color: 'var(--primary)' }} />
      <p>Loading...</p>
    </div>
  );
}
