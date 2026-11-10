import React from 'react';
import { ManagedContentBlock } from '../types';

function safeHref(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^(https:\/\/|mailto:|tel:)/i.test(trimmed) ? trimmed : undefined;
}

export const ManagedContentList: React.FC<{
  blocks?: ManagedContentBlock[];
  preview?: boolean;
  className?: string;
}> = ({ blocks = [], preview = false, className = '' }) => {
  const visibleBlocks = blocks.filter(block => block.visible);
  if (!visibleBlocks.length) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {visibleBlocks.map(block => {
        const style: React.CSSProperties = {
          textAlign: block.alignment || 'left',
          backgroundColor: block.backgroundColor || undefined,
          color: block.textColor || undefined,
          borderColor: block.borderColor || undefined,
          fontSize: block.fontSize || undefined,
          padding: block.padding || undefined
        };
        const title = block.title?.trim();
        const body = block.body?.trim();
        const href = safeHref(block.linkUrl);
        const isFramed = ['card', 'announcement', 'footer-column'].includes(block.type);

        if (block.type === 'divider') return <hr key={block.id} className="border-slate-200" style={style} />;
        if (block.type === 'image') {
          const imageHref = safeHref(block.imageUrl);
          if (!imageHref) return null;
          return <img key={block.id} src={imageHref} alt={title || ''} className="max-h-48 max-w-full object-contain" style={style} loading="lazy" />;
        }
        if (block.type === 'button' || block.type === 'link') {
          return href ? (
            <a key={block.id} href={href} className={block.type === 'button' ? 'inline-flex items-center rounded-md bg-blue-900 px-3 py-2 text-sm font-semibold text-white no-underline' : 'font-medium text-blue-800 underline'} style={style} target={href.startsWith('https://') ? '_blank' : undefined} rel={href.startsWith('https://') ? 'noreferrer' : undefined}>
              {block.buttonLabel || title || body || 'Open link'}
            </a>
          ) : null;
        }

        const heading = block.type === 'heading' || Boolean(title);
        const blockClasses = `${isFramed ? 'rounded-md border border-slate-200' : ''} ${block.type === 'announcement' ? 'border-l-4 border-l-amber-500' : ''}`;
        const columns = block.type === 'two-column' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : block.type === 'three-column' ? 'grid grid-cols-1 sm:grid-cols-3 gap-3' : '';
        return (
          <section key={block.id} className={`${blockClasses} ${columns}`} style={style}>
            <div className={columns ? 'sm:col-span-full' : ''}>
              {heading && <h3 className="font-semibold text-base">{title}</h3>}
              {body && <p className={`${heading ? 'mt-1' : ''} whitespace-pre-wrap text-sm leading-relaxed`}>{body}</p>}
              {!title && !body && preview && <p className="text-sm text-slate-400">Empty content block</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
};
