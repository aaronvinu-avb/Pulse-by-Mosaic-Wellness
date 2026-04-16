import { Mail, MessageCircle, Link2, Users } from 'lucide-react';

type IconSize = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<IconSize, { box: number; icon: number; radius: number }> = {
  sm: { box: 20, icon: 11, radius: 5 },
  md: { box: 28, icon: 15, radius: 8 },
  lg: { box: 36, icon: 20, radius: 10 },
};

const CHANNEL_CONFIG: Record<string, { bg: string; icon: 'meta' | 'google' | 'google-display' | 'youtube' | 'instagram' | 'email' | 'sms' | 'tiktok' | 'link' | 'x' }> = {
  'Meta Ads': { bg: '#1877F2', icon: 'meta' },
  'Google Search': { bg: '#4285F4', icon: 'google' },
  'Google Display': { bg: '#34A853', icon: 'google-display' },
  'YouTube': { bg: '#FF0000', icon: 'youtube' },
  'Instagram Reels': { bg: '#E1306C', icon: 'instagram' },
  'Email': { bg: '#6366F1', icon: 'email' },
  'SMS': { bg: '#10B981', icon: 'sms' },
  'Influencer': { bg: '#F97316', icon: 'tiktok' },
  'Affiliate': { bg: '#22C55E', icon: 'link' },
  'Organic Social': { bg: '#8B5CF6', icon: 'x' },
};

function MetaIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M6.915 4.03c-1.968 0-3.412 1.06-4.26 2.605C1.826 8.13 1.5 10.2 1.5 12c0 1.8.326 3.87 1.155 5.365.848 1.545 2.292 2.605 4.26 2.605 1.47 0 2.564-.55 3.6-1.58.904-.9 1.69-2.11 2.485-3.39.795 1.28 1.58 2.49 2.485 3.39 1.036 1.03 2.13 1.58 3.6 1.58 1.968 0 3.412-1.06 4.26-2.605.829-1.495 1.155-3.565 1.155-5.365 0-1.8-.326-3.87-1.155-5.365C22.497 5.09 21.053 4.03 19.085 4.03c-1.47 0-2.564.55-3.6 1.58-.904.9-1.69 2.11-2.485 3.39-.795-1.28-1.58-2.49-2.485-3.39-1.036-1.03-2.13-1.58-3.6-1.58zm0 2.14c.865 0 1.553.37 2.378 1.186.717.712 1.445 1.733 2.199 2.903L13 12l-1.508 1.741c-.754 1.17-1.482 2.191-2.199 2.903-.825.816-1.513 1.186-2.378 1.186-1.273 0-2.175-.674-2.813-1.835C3.488 14.91 3.2 13.2 3.2 12c0-1.2.288-2.91.902-3.995.638-1.161 1.54-1.835 2.813-1.835zm12.17 0c1.273 0 2.175.674 2.813 1.835.614 1.085.902 2.795.902 3.995 0 1.2-.288 2.91-.902 3.995-.638 1.161-1.54 1.835-2.813 1.835-.865 0-1.553-.37-2.378-1.186-.717-.712-1.445-1.733-2.199-2.903L15 12l1.508-1.741c.754-1.17 1.482-2.191 2.199-2.903.825-.816 1.513-1.186 2.378-1.186z"/>
    </svg>
  );
}

function GoogleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
    </svg>
  );
}

function YouTubeIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function InstagramIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  );
}

function TikTokIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  );
}

function XIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

interface ChannelIconProps {
  channel: string;
  size?: IconSize;
}

export function ChannelIcon({ channel, size = 'md' }: ChannelIconProps) {
  const config = CHANNEL_CONFIG[channel];
  const s = SIZE_MAP[size];
  
  if (!config) return null;

  const renderIcon = () => {
    switch (config.icon) {
      case 'meta': return <MetaIcon size={s.icon} />;
      case 'google': return <GoogleIcon size={s.icon} />;
      case 'google-display': return <GoogleIcon size={s.icon} />;
      case 'youtube': return <YouTubeIcon size={s.icon} />;
      case 'instagram': return <InstagramIcon size={s.icon} />;
      case 'email': return <Mail size={s.icon} color="white" strokeWidth={2.5} />;
      case 'sms': return <MessageCircle size={s.icon} color="white" strokeWidth={2.5} />;
      case 'tiktok': return <TikTokIcon size={s.icon} />;
      case 'link': return <Link2 size={s.icon} color="white" strokeWidth={2.5} />;
      case 'x': return <XIcon size={s.icon} />;
      default: return null;
    }
  };

  return (
    <div
      style={{
        width: s.box,
        height: s.box,
        borderRadius: s.radius,
        backgroundColor: config.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {renderIcon()}
    </div>
  );
}
