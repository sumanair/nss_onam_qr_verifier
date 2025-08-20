export default function NumberStepper({ value, setValue, min=1, max=1, label }:{ value:number; setValue:(n:number)=>void; min?:number; max?:number; label:string; }){
  const clamp = (n:number)=> Math.max(min, Math.min(max, n||min));
  return (
    <label className="nbox">
      {label}
      <div className="stepper">
        <button className="btn btn-outline-gold btn-step" onClick={(e)=>{e.preventDefault(); setValue(clamp(value-1));}} disabled={value<=min} aria-label={`Decrease ${label}`}>−</button>
        <input type="number" min={min} max={max} value={value} onChange={(e)=>setValue(clamp(Number(e.target.value)))} />
        <button className="btn btn-outline-gold btn-step" onClick={(e)=>{e.preventDefault(); setValue(clamp(value+1));}} disabled={value>=max} aria-label={`Increase ${label}`}>+</button>
      </div>
    </label>
  );
}
