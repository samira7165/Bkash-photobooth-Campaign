'use client';

import { useEffect, useState } from 'react';
import { getDownloadGallery, DownloadGallery as DownloadGalleryData } from '@/services/api';

interface Props {
  token: string;
}

function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function DownloadGallery({ token }: Props) {
  const [data, setData] = useState<DownloadGalleryData | null>(null);
  const [error, setError] = useState('');
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    getDownloadGallery(token)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token]);

  const downloadAll = async () => {
    if (!data) return;
    setDownloadingAll(true);
    const urls = [data.originalUrl, data.aiUrl, data.comicUrl, data.pdfUrl].filter(Boolean) as string[];
    for (const url of urls) {
      triggerDownload(`${url}?download=1`);
      await new Promise((r) => setTimeout(r, 400));
    }
    setDownloadingAll(false);
  };

  if (error) {
    return (
      <div className="download-card">
        <h2 className="download-title">Something went wrong</h2>
        <p className="download-sub">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="download-card">
        <div className="download-spinner" />
      </div>
    );
  }

  if (data.processingStatus === 'queued' || data.processingStatus === 'processing') {
    return (
      <div className="download-card">
        <h2 className="download-title">Still preparing your image</h2>
        <p className="download-sub">Your dream career image isn&apos;t quite ready yet. Please check back in a minute.</p>
        <div className="download-spinner" />
      </div>
    );
  }

  if (data.processingStatus === 'failed') {
    return (
      <div className="download-card">
        <h2 className="download-title">We couldn&apos;t create your image</h2>
        <p className="download-sub">Something went wrong while generating your photo. Please contact the event organizer.</p>
      </div>
    );
  }

  const items = [
    { key: 'original', label: 'Original Photo', url: data.originalUrl },
    { key: 'ai', label: 'Dream Career Image', url: data.aiUrl },
    { key: 'comic', label: 'Comic Image', url: data.comicUrl },
    { key: 'pdf', label: 'Event PDF', url: data.pdfUrl },
  ].filter((item) => item.url);

  return (
    <div className="download-card wide">
      <h2 className="download-title">Your images are ready</h2>
      <p className="download-sub">Preview and download each item below, or download everything at once.</p>

      <div className="download-gallery-grid">
        {items.map((item) => (
          <div className="download-item" key={item.key}>
            {item.key === 'pdf' ? (
              <div className="download-item-pdf-icon">PDF</div>
            ) : (
              <img className="download-item-preview" src={item.url!} alt={item.label} />
            )}
            <span className="download-item-label">{item.label}</span>
            <a className="download-item-btn" href={`${item.url}?download=1`} download>
              Download
            </a>
          </div>
        ))}
      </div>

      <button className="download-btn-primary" onClick={downloadAll} disabled={downloadingAll}>
        {downloadingAll ? 'Downloading…' : 'Download All'}
      </button>
    </div>
  );
}
