import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Peer-to-peer video/audio for a watch room.
 *
 * Signalling runs over a Lovable Cloud realtime channel:
 *  - presence tells us who is in the room
 *  - broadcast carries SDP offers/answers and ICE candidates
 *
 * Deterministic ordering (lower user id creates the offer) avoids glare,
 * and peers automatically re-negotiate when a connection drops.
 */

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
};

export type RemotePeer = { userId: string; stream: MediaStream };

type SignalPayload = {
  from: string;
  to: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

export function useWebRTC(roomId: string | undefined, userId: string | undefined) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);

  const updatePeerStream = useCallback((peerId: string, stream: MediaStream) => {
    setPeers((prev) => {
      const rest = prev.filter((p) => p.userId !== peerId);
      return [...rest, { userId: peerId, stream }];
    });
  }, []);

  const createPeer = useCallback(
    (peerId: string) => {
      const existing = pcs.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      const remote = new MediaStream();

      localRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localRef.current as MediaStream);
      });

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
        updatePeerStream(peerId, remote);
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || !userId) return;
        channelRef.current?.send({
          type: "broadcast",
          event: "signal",
          payload: { from: userId, to: peerId, candidate: event.candidate.toJSON() },
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          pc.restartIce();
        }
        if (pc.connectionState === "closed") {
          pcs.current.delete(peerId);
          setPeers((prev) => prev.filter((p) => p.userId !== peerId));
        }
      };

      pcs.current.set(peerId, pc);
      return pc;
    },
    [updatePeerStream, userId],
  );

  const callPeer = useCallback(
    async (peerId: string) => {
      if (!userId) return;
      const pc = createPeer(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      channelRef.current?.send({
        type: "broadcast",
        event: "signal",
        payload: { from: userId, to: peerId, description: offer },
      });
    },
    [createPeer, userId],
  );

  // Signalling channel lifecycle
  useEffect(() => {
    if (!roomId || !userId) return;

    const channel = supabase.channel(`rtc:${roomId}`, {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const others = Object.keys(state).filter((id) => id !== userId);
      others.forEach((peerId) => {
        if (pcs.current.has(peerId)) return;
        // deterministic caller avoids offer glare
        if (userId < peerId) void callPeer(peerId);
      });
      // clean up peers who left
      pcs.current.forEach((pc, peerId) => {
        if (!others.includes(peerId)) {
          pc.close();
          pcs.current.delete(peerId);
          setPeers((prev) => prev.filter((p) => p.userId !== peerId));
        }
      });
    });

    channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
      const msg = payload as SignalPayload;
      if (msg.to !== userId) return;
      const pc = createPeer(msg.from);

      if (msg.description) {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.description));
        if (msg.description.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: { from: userId, to: msg.from, description: answer },
          });
        }
      } else if (msg.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch {
          /* candidate arrived before remote description; safe to ignore */
        }
      }
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") void channel.track({ userId, at: Date.now() });
    });

    return () => {
      pcs.current.forEach((pc) => pc.close());
      pcs.current.clear();
      setPeers([]);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, userId, callPeer, createPeer]);

  useEffect(() => {
    return () => {
      localRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const attachTrack = useCallback((track: MediaStreamTrack) => {
    let stream = localRef.current;
    if (!stream) {
      stream = new MediaStream();
      localRef.current = stream;
    }
    stream.addTrack(track);
    setLocalStream(new MediaStream(stream.getTracks()));
    pcs.current.forEach((pc) => pc.addTrack(track, stream as MediaStream));
  }, []);

  const removeTrack = useCallback((track: MediaStreamTrack) => {
    track.stop();
    localRef.current?.removeTrack(track);
    setLocalStream(localRef.current ? new MediaStream(localRef.current.getTracks()) : null);
    pcs.current.forEach((pc) => {
      pc.getSenders()
        .filter((s) => s.track === track)
        .forEach((s) => pc.removeTrack(s));
    });
  }, []);

  const toggleCamera = useCallback(async () => {
    setMediaError(null);
    const current = localRef.current?.getVideoTracks() ?? [];
    if (cameraOn) {
      current.forEach(removeTrack);
      cameraTrackRef.current = null;
      setCameraOn(false);
      setSharingScreen(false);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = media.getVideoTracks()[0];
      cameraTrackRef.current = track;
      attachTrack(track);
      setCameraOn(true);
    } catch {
      setMediaError("Camera permission was denied.");
    }
  }, [cameraOn, attachTrack, removeTrack]);

  const toggleMic = useCallback(async () => {
    setMediaError(null);
    const current = localRef.current?.getAudioTracks() ?? [];
    if (micOn) {
      current.forEach(removeTrack);
      setMicOn(false);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      attachTrack(media.getAudioTracks()[0]);
      setMicOn(true);
    } catch {
      setMediaError("Microphone permission was denied.");
    }
  }, [micOn, attachTrack, removeTrack]);

  const toggleScreenShare = useCallback(async () => {
    setMediaError(null);
    if (sharingScreen) {
      const videoTracks = localRef.current?.getVideoTracks() ?? [];
      videoTracks.forEach(removeTrack);
      setSharingScreen(false);
      setCameraOn(false);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = media.getVideoTracks()[0];
      (localRef.current?.getVideoTracks() ?? []).forEach(removeTrack);
      attachTrack(track);
      track.onended = () => {
        removeTrack(track);
        setSharingScreen(false);
      };
      setSharingScreen(true);
      setCameraOn(true);
    } catch {
      setMediaError("Screen sharing was cancelled.");
    }
  }, [sharingScreen, attachTrack, removeTrack]);

  return {
    localStream,
    peers,
    cameraOn,
    micOn,
    sharingScreen,
    mediaError,
    toggleCamera,
    toggleMic,
    toggleScreenShare,
  };
}
