export function cameraError(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was denied. Allow camera access in your browser settings and try again.';
  if (name === 'NotFoundError') return 'No camera was found on this device.';
  if (name === 'NotReadableError') return 'Your camera is busy. Close other camera apps and try again.';
  return 'The camera preview could not start. Check camera access, your connection and WebGL support.';
}

export function stopTracks(stream: Pick<MediaStream, 'getTracks'> | null) {
  stream?.getTracks().forEach(track => track.stop());
}

export async function openCamera(devices: Pick<MediaDevices, 'getUserMedia'> | undefined, secure: boolean, front: boolean, signal: AbortSignal) {
  if (!secure || !devices?.getUserMedia) throw new Error('Camera unavailable');
  const stream = await devices.getUserMedia({
    video: { facingMode: { ideal: front ? 'user' : 'environment' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 20, max: 30 } },
    audio: false,
  });
  // A permission prompt may outlive the component or the user's stop action.
  if (signal.aborted) {
    stopTracks(stream);
    throw new DOMException('Camera request cancelled', 'AbortError');
  }
  return stream;
}

