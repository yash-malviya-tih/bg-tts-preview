import { useRef, useState } from 'react';

export const convertBlobToWav = async (blob: Blob): Promise<File> => {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer);
    const numOfChannels = decoded.numberOfChannels;
    const sampleRate = decoded.sampleRate;
    const blockAlign = numOfChannels * 2;
    const buffer = new ArrayBuffer(44 + decoded.length * blockAlign);
    const view = new DataView(buffer);
    const writeString = (view: DataView, offset: number, text: string) => {
      for (let i = 0; i < text.length; i++) {
        view.setUint8(offset + i, text.charCodeAt(i));
      }
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + decoded.length * blockAlign, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, decoded.length * blockAlign, true);
    let offset = 44;
    const channels: Float32Array[] = [];
    for (let channel = 0; channel < numOfChannels; channel++) {
      channels.push(decoded.getChannelData(channel));
    }
    for (let i = 0; i < decoded.length; i++) {
      for (let channel = 0; channel < numOfChannels; channel++) {
        let sample = channels[channel][i];
        sample = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    return new File([view], 'recorded-reference.wav', { type: 'audio/wav' });
  } finally {
    audioContext.close();
  }
};

export interface UseVoiceRecorderOptions {
  onRecorded: (file: File) => void;
}

export const useVoiceRecorder = ({ onRecorded }: UseVoiceRecorderOptions) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const handleRecordToggle = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError('Audio recording is not supported in this browser');
      return;
    }

    try {
      setRecordingError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordingChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const chunkType = recordingChunksRef.current[0]?.type || mimeType || 'audio/webm';
        const extension = chunkType.includes('wav') ? 'wav' : chunkType.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(recordingChunksRef.current, { type: chunkType });
        if (blob.size > 0) {
          let file: File = new File([blob], 'recorded-reference.' + extension, { type: chunkType });
          try {
            file = await convertBlobToWav(blob);
          } catch (err) {
            console.warn('WAV conversion failed, using original blob', err);
          }
          onRecorded(file);
        }
        recordingChunksRef.current = [];
      };

      recorder.onerror = () => {
        setRecordingError('Recording failed. Please try again.');
        setIsRecording(false);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setRecordingError(err?.message || 'Microphone access was denied');
      setIsRecording(false);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const clearRecordingError = () => setRecordingError(null);

  return { isRecording, recordingError, clearRecordingError, handleRecordToggle };
};
