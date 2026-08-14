'use client';
import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize, Minimize, X, Loader2, FileText, Download } from 'lucide-react';
import { downloadFile } from '@/lib/api';

interface PdfViewerModalProps {
  statementId: string;
  title: string;
  payPeriod: string;
  onClose: () => void;
}

export function PdfViewerModal({ statementId, title, payPeriod, onClose }: PdfViewerModalProps) {
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const formattedDate = new Date(payPeriod).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.15, 0.6));
  const handleResetZoom = () => setScale(1.0);

  const handleDownload = async () => {
    try {
      const extDate = new Date(payPeriod).toISOString().slice(0, 10);
      await downloadFile(
        `/salary-statements/${statementId}/download`,
        `payslip-${extDate}.pdf`
      );
    } catch (err) {
      console.error('Failed to download payslip', err);
    }
  };

  const toggleFullscreen = () => {
    if (!modalRef.current) return;
    if (!document.fullscreenElement) {
      modalRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="modal-wrap pdf-viewer-wrap">
      <button className="backdrop" onClick={onClose} aria-label="Close document viewer" />
      <div 
        ref={modalRef} 
        className={`modal pdf-viewer-modal ${isFullscreen ? 'fullscreen' : ''}`}
        role="dialog" 
        aria-modal="true"
      >
        <header className="pdf-viewer-header">
          <div className="pdf-viewer-title">
            <span className="pdf-icon-wrapper"><FileText size={18} /></span>
            <div>
              <strong>{title}</strong>
              <small>Payslip for {formattedDate}</small>
            </div>
          </div>
          
          <div className="pdf-viewer-controls">
            <button 
              type="button" 
              className="control-btn" 
              onClick={handleZoomOut} 
              disabled={scale <= 0.6}
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="zoom-indicator">{Math.round(scale * 100)}%</span>
            <button 
              type="button" 
              className="control-btn" 
              onClick={handleZoomIn} 
              disabled={scale >= 2.0}
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button 
              type="button" 
              className="control-btn" 
              onClick={handleResetZoom} 
              disabled={scale === 1.0}
              title="Reset Zoom"
            >
              <RotateCcw size={15} />
            </button>
            <div className="control-divider" />
            <button 
              type="button" 
              className="control-btn" 
              onClick={handleDownload}
              title="Download Payslip PDF"
            >
              <Download size={16} />
            </button>
            <button 
              type="button" 
              className="control-btn" 
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
            <button 
              type="button" 
              className="control-btn close-btn" 
              onClick={onClose}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="pdf-viewer-body">
          {loading && (
            <div className="pdf-loading-overlay">
              <Loader2 size={32} className="spin" />
              <span>Decrypting & rendering document…</span>
            </div>
          )}
          <div className="pdf-viewport">
            <iframe
              src={`/api/salary-statements/${statementId}/view#toolbar=0`}
              className="pdf-iframe"
              onLoad={() => setLoading(false)}
              style={{
                width: `${100 / scale}%`,
                height: `${100 / scale}%`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
