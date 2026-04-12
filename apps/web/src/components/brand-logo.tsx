import Image from 'next/image';

type BrandLogoProps = {
  size?: 'sidebar' | 'hero' | 'auth';
  caption?: string;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  size = 'sidebar',
  caption,
  className,
  priority = false,
}: BrandLogoProps) {
  const classes = ['pv-brand-lockup', `pv-brand-lockup-${size}`, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="pv-brand-logo-frame">
        <Image
          src="/brand/papervest-logo.png"
          alt="PaperVest logo"
          width={768}
          height={768}
          priority={priority}
          className="pv-brand-logo-image"
          sizes={size === 'sidebar' ? '160px' : size === 'auth' ? '220px' : '280px'}
        />
      </div>
      {caption ? <span className="pv-brand-caption">{caption}</span> : null}
    </div>
  );
}
