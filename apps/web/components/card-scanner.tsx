'use client';
import { useRef, useState } from 'react';
import { Camera, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Tesseract from 'tesseract.js';

export interface CardScanResult {
  cardNumber?: string;
  expiryMm?: number;
  expiryYy?: number;
  cvv?: string;
}

interface CardScannerProps {
  onResult: (result: CardScanResult) => void;
}

/* ── Image generation variants via Canvas ───────────────────── */

interface PreparedImages {
  raw: string;
  highContrast: string;
  threshold: string;
}

function prepareImageVariants(file: File): Promise<PreparedImages> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const TARGET_WIDTH = 1200;
      const scale = TARGET_WIDTH / img.width;
      const width = TARGET_WIDTH;
      const height = img.height * scale;

      // 1. Raw variant
      const canvasRaw = document.createElement('canvas');
      canvasRaw.width = width;
      canvasRaw.height = height;
      const ctxRaw = canvasRaw.getContext('2d');
      if (!ctxRaw) { reject(new Error('Canvas context raw failed')); return; }
      ctxRaw.drawImage(img, 0, 0, width, height);
      const rawDataUrl = canvasRaw.toDataURL('image/png');

      // 2. High Contrast variant
      const canvasContrast = document.createElement('canvas');
      canvasContrast.width = width;
      canvasContrast.height = height;
      const ctxContrast = canvasContrast.getContext('2d');
      if (!ctxContrast) { reject(new Error('Canvas context contrast failed')); return; }
      ctxContrast.drawImage(img, 0, 0, width, height);
      const imgDataContrast = ctxContrast.getImageData(0, 0, width, height);
      const dContrast = imgDataContrast.data;
      for (let i = 0; i < dContrast.length; i += 4) {
        let gray = 0.299 * dContrast[i] + 0.587 * dContrast[i + 1] + 0.114 * dContrast[i + 2];
        // Increase contrast centered on 128
        gray = ((gray - 128) * 1.8) + 128;
        gray = Math.max(0, Math.min(255, gray));
        dContrast[i] = gray;
        dContrast[i + 1] = gray;
        dContrast[i + 2] = gray;
      }
      ctxContrast.putImageData(imgDataContrast, 0, 0);
      const contrastDataUrl = canvasContrast.toDataURL('image/png');

      // 3. Binary Threshold variant
      const canvasThreshold = document.createElement('canvas');
      canvasThreshold.width = width;
      canvasThreshold.height = height;
      const ctxThreshold = canvasThreshold.getContext('2d');
      if (!ctxThreshold) { reject(new Error('Canvas context threshold failed')); return; }
      ctxThreshold.drawImage(img, 0, 0, width, height);
      const imgDataThreshold = ctxThreshold.getImageData(0, 0, width, height);
      const dThreshold = imgDataThreshold.data;
      for (let i = 0; i < dThreshold.length; i += 4) {
        let gray = 0.299 * dThreshold[i] + 0.587 * dThreshold[i + 1] + 0.114 * dThreshold[i + 2];
        gray = ((gray - 128) * 2.0) + 128;
        gray = gray > 130 ? 255 : 0;
        dThreshold[i] = gray;
        dThreshold[i + 1] = gray;
        dThreshold[i + 2] = gray;
      }
      ctxThreshold.putImageData(imgDataThreshold, 0, 0);
      const thresholdDataUrl = canvasThreshold.toDataURL('image/png');

      resolve({
        raw: rawDataUrl,
        highContrast: contrastDataUrl,
        threshold: thresholdDataUrl
      });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/* ── Luhn check for card number validation ──────────────────── */

function luhnCheck(num: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (isNaN(n)) return false;
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/* ── OCR text parsing with robust regex ─────────────────────── */

function extractCardDetails(text: string): CardScanResult {
  const result: CardScanResult = {};

  // Clean raw OCR text
  const cleaned = text
    .replace(/[oO]/g, '0')
    .replace(/[iIlL|\[\]]/g, '1')
    .replace(/\s+/g, ' ');

  // 1. Robust Card Number extraction
  // Find any sequence of 13-19 digits that can have spaces, dashes, or dots in between.
  // The pattern matches digits separated by optional whitespace/hyphens.
  const regexCard = /\b(?:\d[\s\-.]*){13,19}\b/g;
  const cardMatches = cleaned.match(regexCard);

  if (cardMatches) {
    for (const match of cardMatches) {
      const digits = match.replace(/[\s\-.]/g, '');
      if (digits.length >= 13 && digits.length <= 19 && luhnCheck(digits)) {
        result.cardNumber = digits;
        break;
      }
    }
    // Fallback if none are Luhn-valid: just pick the first sequence of 15 or 16 digits
    if (!result.cardNumber) {
      for (const match of cardMatches) {
        const digits = match.replace(/[\s\-.]/g, '');
        if (digits.length === 15 || digits.length === 16) {
          result.cardNumber = digits;
          break;
        }
      }
    }
  }

  // 2. Expiry MM/YY or MM/YYYY extraction
  // Match patterns like 12/26, 04-28, 09 / 30, etc.
  const expiryMatches = cleaned.match(/\b(0[1-9]|1[0-2])\s*[\/\-]\s*([2-9]\d)\b/g);
  if (expiryMatches) {
    // Pick the first match that looks like a valid future expiration year
    for (const match of expiryMatches) {
      const parts = match.split(/[\/\-]/);
      const mm = parseInt(parts[0].trim(), 10);
      const yy = parseInt(parts[1].trim(), 10);
      if (mm >= 1 && mm <= 12 && yy >= 25 && yy <= 40) {
        result.expiryMm = mm;
        result.expiryYy = yy;
        break;
      }
    }
  }

  // 3. CVV Extraction (3 or 4 digits)
  // Usually near a label like CVV, CVC, or isolated on the back.
  const cvvLabelMatch = cleaned.match(/(?:CVV|CVC|CVV2|CVC2|CSC|SECURITY|CODE)[\s:]*(\d{3,4})/i);
  if (cvvLabelMatch) {
    result.cvv = cvvLabelMatch[1];
  } else {
    // If no label, search for isolated 3-digit groups that are not part of card number or expiry
    const isolatedDigits = cleaned.match(/\b\d{3}\b/g);
    if (isolatedDigits) {
      for (const digitGroup of isolatedDigits) {
        if (digitGroup !== String(result.expiryMm) && digitGroup !== String(result.expiryYy)) {
          // Verify it's not a substring of the card number
          if (!result.cardNumber || !result.cardNumber.includes(digitGroup)) {
            result.cvv = digitGroup;
            break;
          }
        }
      }
    }
  }

  return result;
}

/* ── Component ──────────────────────────────────────────────── */

type ScanState = 'idle' | 'scanning' | 'success' | 'partial' | 'error';

export function CardScanner({ onResult }: CardScannerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState(0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setState('scanning');
    setProgress(0);

    try {
      // 1. Prepare three different visual variants of the image
      const variants = await prepareImageVariants(file);

      // 2. Create OCR helper
      const runOcr = async (imageUrl: string): Promise<CardScanResult> => {
        const { data } = await Tesseract.recognize(imageUrl, 'eng');
        return extractCardDetails(data.text);
      };

      // ── OCR Strategy Pass 1: Raw (preserves colored background contrast) ──
      setProgress(20);
      let result = await runOcr(variants.raw);

      // ── OCR Strategy Pass 2: High Contrast (useful for silver/gold/embossed text) ──
      if (!result.cardNumber) {
        setProgress(50);
        const secondResult = await runOcr(variants.highContrast);
        result = { ...result, ...secondResult };
      }

      // ── OCR Strategy Pass 3: Binary Threshold (fallback for crisp white/black print) ──
      if (!result.cardNumber) {
        setProgress(80);
        const thirdResult = await runOcr(variants.threshold);
        result = { ...result, ...thirdResult };
      }

      setProgress(100);
      const fieldsFound = [result.cardNumber, result.expiryMm, result.cvv].filter(Boolean).length;

      if (fieldsFound === 0) {
        setState('error');
        setTimeout(() => setState('idle'), 3000);
      } else if (fieldsFound < 3) {
        setState('partial');
        onResult(result);
        setTimeout(() => setState('idle'), 3500);
      } else {
        setState('success');
        onResult(result);
        setTimeout(() => setState('idle'), 3000);
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  return (
    <div className="card-scanner">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {state === 'idle' && (
        <button
          type="button"
          className="card-scanner-btn"
          onClick={() => fileRef.current?.click()}
        >
          <Camera size={16} />
          <span>Scan Card</span>
        </button>
      )}

      {state === 'scanning' && (
        <div className="card-scanner-status scanning">
          <Loader2 size={16} className="card-scanner-spin" />
          <span>Reading card… {progress > 0 ? `${progress}%` : ''}</span>
          <div className="card-scanner-progress">
            <div className="card-scanner-progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {state === 'success' && (
        <div className="card-scanner-status success">
          <CheckCircle2 size={16} />
          <span>Card details detected</span>
        </div>
      )}

      {state === 'partial' && (
        <div className="card-scanner-status partial">
          <CheckCircle2 size={16} />
          <span>Partial read — please verify fields</span>
        </div>
      )}

      {state === 'error' && (
        <div className="card-scanner-status error">
          <AlertCircle size={16} />
          <span>Could not read card. Try again or enter manually.</span>
        </div>
      )}
    </div>
  );
}
