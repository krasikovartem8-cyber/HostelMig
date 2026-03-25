import React from 'react';

const APP_NAME = 'ХостелМиг';
const TAGLINE = 'Учёт проживания, бригад и финансов в общежитии';

export function BrandMark({ variant = 'default', className = '' }) {
  if (variant === 'light') {
    return (
      <div className={className}>
        <p className="font-display text-2xl font-semibold tracking-tight text-white">{APP_NAME}</p>
        <p className="mt-1 text-sm text-white/75 leading-snug max-w-sm">{TAGLINE}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="font-display text-xl font-semibold tracking-tight text-foreground">{APP_NAME}</p>
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
        хостел · бригады · документы
      </p>
    </div>
  );
}
