export default function Frame({
  videoRef,
  active,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>; // 👈 allow null
  active: boolean;
}) {
  return (
    <div className={`frame ${active ? "active" : ""}`}>
      <video ref={videoRef} muted playsInline />
      <div className="corner tl" />
      <div className="corner tr" />
      <div className="corner bl" />
      <div className="corner br" />
      {active && <div className="scanline" aria-hidden="true" />}
      {active && <div className="glow" aria-hidden="true" />}
    </div>
  );
}
