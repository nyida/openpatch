'use client';

import { Star } from 'lucide-react';
import { useFavoritesStore } from '@/stores/favoritesStore';

export function FollowButton({ wallet, className }: { wallet: string; className?: string }) {
  const following = useFavoritesStore((s) => s.isFollowing(wallet));
  const toggle = useFavoritesStore((s) => s.toggleFollow);

  return (
    <button
      type="button"
      className={`btn btn-ghost !p-1.5 ${className ?? ''}`}
      onClick={() => toggle(wallet)}
      title={following ? 'Unfollow trader' : 'Follow trader'}
      aria-pressed={following}
    >
      <Star
        className="w-3.5 h-3.5"
        fill={following ? 'var(--amber)' : 'none'}
        style={{ color: following ? 'var(--amber)' : 'var(--text-3)' }}
      />
    </button>
  );
}
