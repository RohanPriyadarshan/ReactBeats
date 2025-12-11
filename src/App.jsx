import React, { useState, useRef, useEffect } from "react";
import { parseBlob } from "music-metadata-browser";

const defaultCoverSvg =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTAiIGZpbGw9IiMxZTJ5M2IiLz4KPHBhdGggZD0iTTQ2IDI0TDI4IDMyTDI4IDI5LjVDMjggMjcuNTkgMjYuNDEgMjYgMjQuNSAyNkwyMyAyNkwyMyAzOEgyMS41QzE5LjU5IDM4IDE4IDM5LjU5IDE4IDQxLjVMMTggNDMuNUMxOCA0NS40MSAxOS41OSA0NyAyMS41IDQ3SDI0LjVDMjYuNDEgNDcgMjggNDUuNDEgMjggNDMuNVY0MUg0MkM0NC4yMSA0MSA0NiAzOS4yMSA0NiAzN1YzMC41QzQ2IDI4LjI5IDQ0LjIxIDI2LjUgNDIgMjYuNUg0MSIgZmlsbD0iIzk0YTNkOCIgc3Ryb2tlPSIjOTRhM2Q4IiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTI0LjUgMjZDMjYuNDEgMjYgMjggMjcuNTkgMjggMjkuNVYzMiIgc3Ryb2tlPSIjOTRhM2Q4IiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+Cg==";

const playlistData = [
  {
    id: 1,
    title: "Yellow",
    artist: "Coldplay",
    src: "/audio/Yellow.mp3",
  },
  {
    id: 2,
    title: "Mind Over Matter (Reprise)",
    artist: "Young the Giant",
    src: "/audio/Mind Over Matter (Reprise).mp3",
  },
  {
    id: 3,
    title: "Do I Wanna Know",
    artist: "Artic Monkeys",
    src: "/audio/Do I Wanna Know.mp3",
  },
];

function formatTime(time) {
  if (isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function App() {
  const [playlist, setPlaylist] = useState(
    playlistData.map((track) => ({
      ...track,
      cover: track.cover || defaultCoverSvg,
    }))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef(null);

  const currentTrack = playlist[currentIndex];
  const coverSrc = currentTrack?.cover || defaultCoverSvg;

  useEffect(() => {
    let isCancelled = false;
    const objectUrls = [];

    const loadMetadata = async () => {
      const enriched = await Promise.all(
        playlistData.map(async (track) => {
          try {
            const response = await fetch(track.src);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            if (!blob.size) {
              throw new Error("Empty audio blob");
            }

            const metadata = await parseBlob(blob, {
              mimeType: blob.type || "audio/mpeg",
            });

            const title = metadata.common.title || track.title;
            const artist =
              metadata.common.artist ||
              (metadata.common.artists?.join(", ") ?? track.artist);

            let cover = track.cover || defaultCoverSvg;
            const pictures = metadata.common.picture;
            const picture = pictures && pictures.length > 0 ? pictures[0] : null;
            if (picture) {
              const mimeType = picture.format || "image/jpeg";
              const coverUrl = URL.createObjectURL(
                new Blob([picture.data], { type: mimeType })
              );
              objectUrls.push(coverUrl);
              cover = coverUrl;
            } else {
              console.warn("No embedded cover art found for", track.src);
            }

            return { ...track, title, artist, cover };
          } catch (err) {
            console.error("Metadata load failed for", track.src, err);
            return { ...track, cover: track.cover || defaultCoverSvg };
          }
        })
      );

      if (!isCancelled) {
        setPlaylist(enriched);
      }
    };

    loadMetadata();

    return () => {
      isCancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoaded = () => setDuration(audio.duration || 0);
    const handleEnded = () => handleNext(); // auto next

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentIndex]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error("Playback error:", err);
        });
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => {
      const newIndex = prev === 0 ? playlist.length - 1 : prev - 1;
      return newIndex;
    });
    setCurrentTime(0);
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play(), 0);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => {
      const newIndex = prev === playlist.length - 1 ? 0 : prev + 1;
      return newIndex;
    });
    setCurrentTime(0);
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play(), 0);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Number(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSelectTrack = (index) => {
    setCurrentIndex(index);
    setCurrentTime(0);
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play(), 0);
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -right-32 10 top-10 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-10 right-10 h-40 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-10 space-y-8">
        <div className="bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-emerald-500/10 p-6 md:p-8 grid md:grid-cols-[2fr,3fr] gap-6 md:gap-8">
          {/* CURRENT TRACK + CONTROLS */}
          <section className="flex flex-col justify-between gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                  ReactBeats
                </h1>
                <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">
                  Now Playing
                </span>
              </div>

              <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/60 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-inner shadow-black/30">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 md:h-24 md:w-24 rounded-2xl overflow-hidden border border-slate-700/60 shadow-lg shadow-black/30">
                    <img
                      src={coverSrc}
                      alt={`${currentTrack.title} cover`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Track</p>
                    <h2 className="text-xl md:text-2xl font-semibold leading-tight">
                      {currentTrack.title}
                    </h2>
                    <p className="text-sm text-slate-300">{currentTrack.artist}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* PROGRESS + CONTROLS */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <span className="tabular-nums w-12 text-right">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step="0.1"
                  value={Math.min(currentTime, duration || 0)}
                  onChange={handleSeek}
                  className="flex-1 accent-emerald-400"
                  disabled={!duration}
                />
                <span className="tabular-nums w-12">
                  {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handlePrev}
                  className="px-3 py-2 rounded-full bg-slate-800 border border-slate-700 hover:border-emerald-400/60 hover:bg-slate-700 transition text-sm shadow-md"
                >
                  ⏮
                </button>
                <button
                  onClick={handlePlayPause}
                  className="px-7 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm transition shadow-lg shadow-emerald-500/30"
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  onClick={handleNext}
                  className="px-3 py-2 rounded-full bg-slate-800 border border-slate-700 hover:border-emerald-400/60 hover:bg-slate-700 transition text-sm shadow-md"
                >
                  ⏭
                </button>
              </div>
            </div>

            {/* HIDDEN AUDIO ELEMENT */}
            <audio ref={audioRef} src={currentTrack.src} preload="metadata" />
          </section>

          {/* PLAYLIST */}
          <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 md:p-5 overflow-y-auto shadow-inner shadow-black/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Playlist</h3>
              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                {playlist.length} Tracks
              </span>
            </div>
            <ul className="space-y-2">
              {playlist.map((track, index) => {
                const isActive = index === currentIndex;
                return (
                  <li key={track.id}>
                    <button
                      onClick={() => handleSelectTrack(index)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-sm md:text-base transition flex items-center justify-between
                      ${
                        isActive
                          ? "bg-gradient-to-r from-emerald-500/15 via-emerald-400/10 to-transparent border-emerald-400/70 shadow-lg shadow-emerald-500/10 scale-[1.01]"
                          : "bg-slate-800/60 border-slate-700 hover:bg-slate-700/70 hover:border-emerald-400/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg overflow-hidden border border-slate-700/70">
                          <img
                            src={track.cover || defaultCoverSvg}
                            alt={`${track.title} cover`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <p
                            className={`font-medium ${
                              isActive ? "text-emerald-300" : "text-slate-50"
                            }`}
                          >
                            {track.title}
                          </p>
                          <p className="text-xs text-slate-300">
                            {track.artist}
                          </p>
                        </div>
                      </div>
                      {isActive && (
                        <span className="text-[10px] uppercase tracking-wide text-emerald-300">
                          Now Playing
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <footer className="text-center text-xs text-slate-400">
          Made by Rohan
        </footer>
      </div>
    </div>
  );
}
