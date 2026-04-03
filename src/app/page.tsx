'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="loading-overlay" style={{ minHeight: '100vh' }}>
      <div className="spinner spinner-lg"></div>
      <p>Loading...</p>
    </div>
  );
}
