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

/* ── Image preprocessing via Canvas ─────────────────────────── */

function preprocessImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const TARGET_WIDTH = 1200;
      const scale = TARGET_WIDTH / img.width;
      canvas.width = TARGET_WIDTH;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      // Draw resized
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert to grayscale + increase contrast
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale using luminance formula
        let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Increase contrast (factor 1.8, centered on 128)
        gray = ((gray - 128) * 1.8) + 128;
        gray = Math.max(0, Math.min(255, gray));

        // Binary threshold for sharper text
        gray = gray > 140 ? 255 : 0;

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/* ── OCR text parsing with regex ────────────────────────────── */

function extractCardDetails(text: string): CardScanResult {
  const result: CardScanResult = {};

  // Normalize: collapse whitespace, remove common OCR artifacts
  const cleaned = text
    .replace(/[oO]/g, (m) => {
      // In digit context, 'O'/'o' is likely '0'
      return m;
    })
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ');

  // Extract card number: look for 13-19 digit sequences (may be separated by spaces or dashes)
  // Credit card numbers are typically displayed as groups of 4
  const cardPatterns = [
    // 4 groups of 4 digits (most common: Visa, Mastercard)
    /(\d{4}[\s\-.]?\d{4}[\s\-.]?\d{4}[\s\-.]?\d{4})/,
    // Amex: 4-6-5 pattern
    /(\d{4}[\s\-.]?\d{6}[\s\-.]?\d{5})/,
    // Generic: 13-19 consecutive digits
    /(\d{13,19})/,
  ];

  for (const pattern of cardPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const digits = match[1].replace(/[\s\-.]/g, '');
      // Validate with Luhn algorithm
      if (digits.length >= 13 && digits.length <= 19 && luhnCheck(digits)) {
        result.cardNumber = digits;
        break;
      }
    }
  }

  // If no Luhn-valid number found, try without Luhn check (OCR might have errors)
  if (!result.cardNumber) {
    for (const pattern of cardPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const digits = match[1].replace(/[\s\-.]/g, '');
        if (digits.length >= 13 && digits.length <= 19) {
          result.cardNumber = digits;
          break;
        }
      }
    }
  }

  // Extract expiry: MM/YY or MM/YYYY patterns
  const expiryPatterns = [
    /(?:VALID\s*(?:THRU|THROUGH|FROM)|EXP(?:IRY|IRES)?|GOOD\s*THRU)[\s:]*(\d{2})\s*[\/\-]\s*(\d{2,4})/i,
    /(\d{2})\s*[\/\-]\s*(\d{2,4})(?=\s|$)/,
  ];

  for (const pattern of expiryPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const mm = parseInt(match[1], 10);
      let yy = parseInt(match[2], 10);
      if (yy > 2000) yy = yy - 2000; // Convert YYYY to YY
      if (mm >= 1 && mm <= 12 && yy >= 25 && yy <= 99) {
        result.expiryMm = mm;
        result.expiryYy = yy;
        break;
      }
    }
  }

  // Extract CVV: 3-4 digit number (heuristic — look for isolated short digit groups)
  // CVV is typically on the back, so this is best-effort
  const cvvPatterns = [
    /(?:CVV|CVC|CVV2|CVC2|CSC|SECURITY\s*CODE)[\s:]*(\d{3,4})/i,
    // Isolated 3-digit group not part of card number or expiry
  ];

  for (const pattern of cvvPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      result.cvv = match[1];
      break;
    }
  }

  return result;
}

/* ── Luhn check for card number validation ──────────────────── */

function luhnCheck(num: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
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

    // Reset the input so the same file can be re-selected
    e.target.value = '';

    setState('scanning');
    setProgress(0);

    try {
      // Preprocess the image
      const processedDataUrl = await preprocessImage(file);

      // Run OCR
      const { data } = await Tesseract.recognize(processedDataUrl, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      // Extract card details from OCR text
      const result = extractCardDetails(data.text);

      const fieldsFound = [result.cardNumber, result.expiryMm, result.cvv].filter(Boolean).length;

      if (fieldsFound === 0) {
        setState('error');
        setTimeout(() => setState('idle'), 3000);
      } else if (fieldsFound < 3) {
        setState('partial');
        onResult(result);
        setTimeout(() => setState('idle'), 3000);
      } else {
        setState('success');
        onResult(result);
        setTimeout(() => setState('idle'), 3000);
      }
    } catch {
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
          <span>Reading card… {progress}%</span>
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
