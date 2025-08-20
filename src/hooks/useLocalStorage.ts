import { useEffect, useState } from "react";
export function useLocalStorage(key: string, initial: string = "") {
  const [val, setVal] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem(key) || initial : initial));
  useEffect(() => { try { localStorage.setItem(key, val); } catch {} }, [key, val]);
  return [val, setVal] as const;
}