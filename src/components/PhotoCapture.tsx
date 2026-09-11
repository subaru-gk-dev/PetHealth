import { useRef } from 'preact/hooks';
import { shrinkImage } from '../util/photo';

interface Props {
  /** Called with the shrunk JPEG blob for each picked photo. */
  onPhoto: (blob: Blob) => void;
  label?: string;
  /** false = let the user pick from the gallery instead of opening the camera. */
  camera?: boolean;
  /** Long-edge limit for the shrunk image (default 1280). */
  maxEdge?: number;
  testId?: string;
}

/**
 * Opens the rear camera on Android Chrome via <input capture="environment">.
 * On desktop it falls back to a file picker, which is what the smoke test uses.
 */
export function PhotoCapture({
  onPhoto,
  label = '📷 写真を撮る',
  camera = true,
  maxEdge,
  testId = 'photo-input',
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" class="btn secondary" onClick={() => input.current?.click()}>
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture={camera ? 'environment' : undefined}
        hidden
        data-testid={testId}
        onChange={async (ev) => {
          // currentTarget is null after the first await; keep a reference.
          const el = ev.currentTarget as HTMLInputElement;
          const files = el.files ? Array.from(el.files) : [];
          for (const f of files) onPhoto(await shrinkImage(f, maxEdge));
          el.value = '';
        }}
      />
    </>
  );
}
