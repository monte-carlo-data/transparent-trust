'use client';

import { useTheme } from '@/lib/theme-provider';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      alignItems: 'center',
    }}>
      <button
        onClick={() => setTheme('light')}
        title="Light mode"
        style={{
          padding: '6px 8px',
          backgroundColor: theme === 'light' ? 'var(--sidebar-active)' : 'transparent',
          border: '1px solid var(--sidebar-border)',
          borderRadius: '4px',
          color: theme === 'light' ? 'var(--sidebar-foreground)' : 'var(--sidebar-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (theme !== 'light') {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-active)';
            e.currentTarget.style.color = 'var(--sidebar-foreground)';
          }
        }}
        onMouseLeave={(e) => {
          if (theme !== 'light') {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--sidebar-muted)';
          }
        }}
      >
        <Sun size={16} />
      </button>

      <button
        onClick={() => setTheme('dark')}
        title="Dark mode"
        style={{
          padding: '6px 8px',
          backgroundColor: theme === 'dark' ? 'var(--sidebar-active)' : 'transparent',
          border: '1px solid var(--sidebar-border)',
          borderRadius: '4px',
          color: theme === 'dark' ? 'var(--sidebar-foreground)' : 'var(--sidebar-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (theme !== 'dark') {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-active)';
            e.currentTarget.style.color = 'var(--sidebar-foreground)';
          }
        }}
        onMouseLeave={(e) => {
          if (theme !== 'dark') {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--sidebar-muted)';
          }
        }}
      >
        <Moon size={16} />
      </button>

      <button
        onClick={() => setTheme('system')}
        title="System preference"
        style={{
          padding: '6px 8px',
          backgroundColor: theme === 'system' ? 'var(--sidebar-active)' : 'transparent',
          border: '1px solid var(--sidebar-border)',
          borderRadius: '4px',
          color: theme === 'system' ? 'var(--sidebar-foreground)' : 'var(--sidebar-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (theme !== 'system') {
            e.currentTarget.style.backgroundColor = 'var(--sidebar-active)';
            e.currentTarget.style.color = 'var(--sidebar-foreground)';
          }
        }}
        onMouseLeave={(e) => {
          if (theme !== 'system') {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--sidebar-muted)';
          }
        }}
      >
        <Monitor size={16} />
      </button>
    </div>
  );
}
