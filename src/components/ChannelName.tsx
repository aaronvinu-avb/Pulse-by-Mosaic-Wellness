const CHANNEL_ICONS: Record<string, { src: string; alt: string }> = {
  'Meta Ads': { src: 'https://cdn.simpleicons.org/meta', alt: 'Meta' },
  'Google Search': { src: 'https://cdn.simpleicons.org/google', alt: 'Google' },
  'Google Display': { src: 'https://cdn.simpleicons.org/googleads', alt: 'Google Ads' },
  'YouTube': { src: 'https://cdn.simpleicons.org/youtube', alt: 'YouTube' },
  'Instagram Reels': { src: 'https://cdn.simpleicons.org/instagram', alt: 'Instagram' },
  'Email': { src: 'https://cdn.simpleicons.org/gmail', alt: 'Gmail' },
  'SMS': { src: 'https://cdn.simpleicons.org/googlemessages', alt: 'SMS' },
  'Influencer': { src: 'https://cdn.simpleicons.org/tiktok', alt: 'TikTok' },
  'Affiliate': { src: 'https://cdn.simpleicons.org/linkfire', alt: 'Affiliate' },
  'Organic Social': { src: 'https://cdn.simpleicons.org/buffer', alt: 'Organic Social' },
};

const imgStyle: React.CSSProperties = { borderRadius: 3, opacity: 0.85, flexShrink: 0 };

interface ChannelNameProps {
  channel: string;
  style?: React.CSSProperties;
}

export function ChannelName({ channel, style }: ChannelNameProps) {
  const icon = CHANNEL_ICONS[channel];
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10, ...style }}>
      {icon && <img src={icon.src} width={16} height={16} alt={icon.alt} style={imgStyle} />}
      {channel}
    </span>
  );
}
