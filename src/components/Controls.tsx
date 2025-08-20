export default function Controls({ onStart, onStop, onClear, canStart, canStop }:{
  onStart: ()=>void; onStop:()=>void; onClear:()=>void; canStart:boolean; canStop:boolean;
}){
  return (
    <div className="controls">
      <button className="btn btn-maroon" onClick={onStart} disabled={!canStart}>🎥 Start</button>
      <button className="btn btn-danger" onClick={onStop} disabled={!canStop}>⏹️ Stop</button>
      <button className="btn btn-blue" onClick={onClear}>🧹 Clear</button>
    </div>
  );
}